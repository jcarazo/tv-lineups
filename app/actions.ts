"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getDb } from "@/lib/db/client";
import * as cats from "@/lib/data/categories";
import * as chans from "@/lib/data/channels";
import * as countries from "@/lib/data/countries";
import { DomainError, type ActionResult } from "@/lib/data/errors";
import { prepareExport, writeExport, type ExportPreview } from "@/lib/data/exporter";
import {
  applyImport,
  parseImportFile,
  planImport,
  type ConflictDecision,
  type ImportMode,
  type ImportPlan,
  type ImportReport,
} from "@/lib/data/importer";
import * as lineups from "@/lib/data/lineups";
import { channelInputSchema, fieldErrors } from "@/lib/domain/validation";
import { channelIdsForCountry, channelIdsForLineup, checkChannelLogos } from "@/lib/logo/service";

async function run<T>(fn: () => T | Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data, message };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input", fieldErrors: fieldErrors(err) };
    }
    if (err instanceof DomainError) {
      return { ok: false, error: err.message, fieldErrors: err.field ? { [err.field]: err.message } : undefined };
    }
    console.error(err);
    return { ok: false, error: "Unexpected error, see server logs" };
  }
}

// Countries ---------------------------------------------------------------

export async function createCountryAction(code: string) {
  return run(() => countries.createCountry(getDb(), code), "Country created");
}

export async function deleteCountryAction(code: string) {
  return run(() => countries.deleteCountry(getDb(), code), "Country deleted");
}

// Categories --------------------------------------------------------------

export async function createCategoryAction(name: string) {
  return run(() => void cats.createCategory(getDb(), name), "Category added");
}

export async function renameCategoryAction(id: number, name: string) {
  return run(() => cats.renameCategory(getDb(), id, name), "Category renamed");
}

export async function deleteCategoryAction(id: number) {
  return run(() => cats.deleteCategory(getDb(), id), "Category deleted");
}

export async function moveCategoryAction(id: number, direction: "up" | "down") {
  return run(() => cats.moveCategory(getDb(), id, direction));
}

// Channels ----------------------------------------------------------------

export interface ChannelFormValues {
  name: string;
  logo: string;
  keywords: string[];
  epgIds: string[];
  categoryId: string;
}

/** Creates or updates a channel; the logo is checked right away when it changed. */
export async function saveChannelAction(countryCode: string, id: number | null, values: ChannelFormValues) {
  return run(async () => {
    const db = getDb();
    const input = channelInputSchema.parse(values);
    if (id == null) {
      const created = chans.createChannel(db, countryCode, input);
      await checkChannelLogos(db, [created.id]);
      return { id: created.id };
    }
    const { logoChanged } = chans.updateChannel(db, id, input);
    if (logoChanged) await checkChannelLogos(db, [id]);
    return { id };
  }, "Channel saved");
}

export async function channelUsageAction(id: number) {
  return chans.channelUsage(getDb(), id);
}

export async function deleteChannelAction(id: number) {
  return run(() => chans.deleteChannel(getDb(), id), "Channel deleted");
}

export async function setLogoFlagAction(id: number, flagged: boolean, note: string | null) {
  return run(() => chans.setLogoFlag(getDb(), id, flagged, note), flagged ? "Logo flagged" : "Flag cleared");
}

// Logo checks --------------------------------------------------------------

function checkSummary(r: { checked: number; broken: number }) {
  return `${r.checked} logo(s) checked, ${r.broken} broken or missing`;
}

export async function checkLogosAction(scope: { channelId: number } | { lineupId: number } | { countryCode: string }) {
  return run(async () => {
    const db = getDb();
    const ids =
      "channelId" in scope
        ? [scope.channelId]
        : "lineupId" in scope
          ? channelIdsForLineup(db, scope.lineupId)
          : channelIdsForCountry(db, scope.countryCode);
    const r = await checkChannelLogos(db, ids);
    return { ...r, summary: checkSummary(r) };
  });
}

// Lineups -----------------------------------------------------------------

export async function createLineupAction(countryCode: string, name: string, slug: string) {
  return run(() => lineups.createLineup(getDb(), countryCode, name, slug), "Lineup created");
}

export async function renameLineupAction(id: number, name: string, slug: string) {
  return run(() => lineups.renameLineup(getDb(), id, name, slug), "Lineup updated");
}

export async function duplicateLineupAction(id: number, name: string, slug: string) {
  return run(() => lineups.duplicateLineup(getDb(), id, name, slug), "Lineup duplicated");
}

export async function deleteLineupAction(id: number) {
  return run(() => lineups.deleteLineup(getDb(), id), "Lineup deleted");
}

export async function addEntriesAction(lineupId: number, items: { channelId: number; dial: number }[]) {
  return run(() => lineups.addEntries(getDb(), lineupId, items), `${items.length} channel(s) added`);
}

export async function updateDialAction(entryId: number, dial: number) {
  return run(() => lineups.updateDial(getDb(), entryId, dial));
}

export async function removeEntryAction(entryId: number) {
  return run(() => lineups.removeEntry(getDb(), entryId), "Removed from lineup");
}

// Export ------------------------------------------------------------------

/** Re-checks the lineup's logos, then returns the fresh preview. */
export async function recheckAndPreviewAction(lineupId: number): Promise<ActionResult<ExportPreview>> {
  return run(async () => {
    const db = getDb();
    await checkChannelLogos(db, channelIdsForLineup(db, lineupId));
    return prepareExport(db, lineupId);
  });
}

export async function writeExportAction(lineupId: number) {
  return run(() => writeExport(getDb(), lineupId), "File written");
}

export async function writeCountryExportsAction(countryCode: string) {
  return run(() => {
    const db = getDb();
    const written: string[] = [];
    const blocked: string[] = [];
    for (const l of lineups.listLineups(db, countryCode)) {
      const preview = prepareExport(db, l.id);
      if (preview.blockers.length) blocked.push(`${preview.fileName} (${preview.blockers.length} issue(s))`);
      else written.push(writeExport(db, l.id).fileName);
    }
    return { written, blocked };
  });
}

// Import ------------------------------------------------------------------

/** `mode` null = the file's natural mode (lineup files → lineup, channel files → channels). */
export async function planImportAction(
  text: string,
  countryCode: string | null,
  mode: ImportMode | null = null,
): Promise<ActionResult<ImportPlan>> {
  return run(() => {
    const file = parseImportFile(text);
    return planImport(getDb(), file, countryCode ?? file.country, mode ?? undefined);
  });
}

export async function applyImportAction(args: {
  text: string;
  countryCode: string;
  mode: ImportMode;
  lineupName: string;
  lineupSlug: string;
  decisions: Record<number, ConflictDecision>;
}): Promise<ActionResult<ImportReport>> {
  return run(async () => {
    const db = getDb();
    const report = applyImport(db, { ...args, file: parseImportFile(args.text) });
    await checkChannelLogos(db, report.importedChannelIds);
    return report;
  }, "Import complete");
}
