import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { categories, channels, lineupEntries, type Channel } from "../db/schema";
import { CHANNELS_FORMAT } from "../domain/constants";
import {
  cleanList,
  importFileSchema,
  normalizeKeywords,
  type ImportFile,
  type ImportFileChannel,
} from "../domain/validation";
import { isoCountryName } from "../iso-countries";
import { ensureCategory } from "./categories";
import { findChannelByName, getChannel } from "./channels";
import { createCountry, getCountry } from "./countries";
import { DomainError } from "./errors";
import { createLineup } from "./lineups";

/** "lineup": create a lineup with the file's dials. "channels": only add channels to the country. */
export type ImportMode = "lineup" | "channels";

/**
 * Per-row choice. Existing channels: use (leave as is) / update / merge.
 * New channels are created unless set to "skip"; "skip" ignores any row.
 */
export type ConflictDecision = "use" | "update" | "merge" | "skip";

export function parseImportFile(text: string): ImportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DomainError("The file is not valid JSON");
  }
  const parsed = importFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new DomainError(`Not a lineup or channels file: ${first.path.join(".") || "root"} ${first.message}`);
  }
  return parsed.data;
}

/** The mode a file is meant for: channel files have no dials to build a lineup from. */
export function defaultImportMode(file: ImportFile): ImportMode {
  return file.format === CHANNELS_FORMAT ? "channels" : "lineup";
}

export interface ImportRow {
  index: number;
  incoming: ImportFileChannel;
  existing: (Pick<Channel, "id" | "name" | "logo" | "keywords" | "epgIds"> & { categoryName: string | null }) | null;
  /** Why this row can't be imported (duplicate name/dial in the file, missing dial for a lineup). */
  skipReason: string | null;
}

export interface ImportPlan {
  mode: ImportMode;
  countryCode: string;
  countryName: string;
  countryExists: boolean;
  suggestedName: string;
  rows: ImportRow[];
  unknownCategories: string[];
}

/** Matches incoming channels to existing ones (by name, case-insensitive) without writing anything. */
export function planImport(db: DB, file: ImportFile, countryCode: string, mode: ImportMode = defaultImportMode(file)): ImportPlan {
  const code = countryCode.toUpperCase();
  const countryName = isoCountryName(code);
  if (!countryName) throw new DomainError(`"${countryCode}" is not an ISO 3166 country code`);
  const countryExists = !!getCountry(db, code);
  const knownCategories = new Set(db.select({ name: categories.name }).from(categories).all().map((c) => c.name.toLowerCase()));

  const seenDials = new Set<number>();
  const seenNames = new Set<string>();
  const unknown = new Set<string>();
  const rows = file.channels.map((incoming, index): ImportRow => {
    let skipReason: string | null = null;
    const nameKey = incoming.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) skipReason = `Channel "${incoming.name}" appears earlier in the file`;
    else if (mode === "lineup") {
      if (incoming.dial == null) skipReason = "No dial";
      else if (seenDials.has(incoming.dial)) skipReason = `Dial ${incoming.dial} appears earlier in the file`;
    }
    if (incoming.dial != null) seenDials.add(incoming.dial);
    seenNames.add(nameKey);
    if (incoming.category && !knownCategories.has(incoming.category.toLowerCase())) unknown.add(incoming.category);

    const match = countryExists ? findChannelByName(db, code, incoming.name) : undefined;
    const existing = match
      ? {
          id: match.id,
          name: match.name,
          logo: match.logo,
          keywords: match.keywords,
          epgIds: match.epgIds,
          categoryName: match.categoryId
            ? db.select({ name: categories.name }).from(categories).where(eq(categories.id, match.categoryId)).get()?.name ?? null
            : null,
        }
      : null;
    return { index, incoming, existing, skipReason };
  });

  return {
    mode,
    countryCode: code,
    countryName,
    countryExists,
    suggestedName: file.name ?? "",
    rows,
    unknownCategories: [...unknown],
  };
}

export interface ImportReport {
  mode: ImportMode;
  /** Only set when a lineup was created. */
  lineupId: number | null;
  lineupSlug: string | null;
  countryCode: string;
  created: string[];
  reused: string[];
  updated: string[];
  merged: string[];
  skipped: string[];
  categoriesCreated: string[];
  countryCreated: boolean;
  /** Imported channels that still miss required fields. */
  incomplete: string[];
  importedChannelIds: number[];
}

function incomingFields(db: DB, c: ImportFileChannel, categoriesCreated: string[]) {
  let categoryId: number | null = null;
  if (c.category?.trim()) {
    const res = ensureCategory(db, c.category);
    if (res.created) categoriesCreated.push(c.category.trim());
    categoryId = res.id;
  }
  const logo = c.logo?.trim() || null;
  return {
    name: c.name.trim(),
    logo,
    keywords: normalizeKeywords(c.keywords ?? []),
    epgIds: cleanList(c.epg_ids ?? []),
    categoryId,
    logoStatus: logo ? ("unchecked" as const) : ("missing" as const),
  };
}

function rowLabel(c: ImportFileChannel) {
  return c.dial != null ? `Dial ${c.dial} · ${c.name}` : c.name;
}

/**
 * Creates/updates channels and, in lineup mode, the lineup that links them.
 * Invalid rows are still imported; they show up as "incomplete" afterwards.
 */
export function applyImport(
  db: DB,
  args: {
    file: ImportFile;
    countryCode: string;
    mode?: ImportMode;
    lineupName?: string;
    lineupSlug?: string | null;
    decisions: Record<number, ConflictDecision>;
  },
): ImportReport {
  return db.transaction((tx) => {
    const mode = args.mode ?? defaultImportMode(args.file);
    const plan = planImport(tx, args.file, args.countryCode, mode);
    const code = plan.countryCode;
    let countryCreated = false;
    if (!plan.countryExists) {
      createCountry(tx, code);
      countryCreated = true;
    }
    const lineup = mode === "lineup" ? createLineup(tx, code, args.lineupName ?? "", args.lineupSlug) : null;
    const report: ImportReport = {
      mode,
      lineupId: lineup?.id ?? null,
      lineupSlug: lineup?.slug ?? null,
      countryCode: code,
      created: [],
      reused: [],
      updated: [],
      merged: [],
      skipped: [],
      categoriesCreated: [],
      countryCreated,
      incomplete: [],
      importedChannelIds: [],
    };
    const touched: number[] = [];

    for (const row of plan.rows) {
      const c = row.incoming;
      const decision = args.decisions[row.index];
      if (row.skipReason) {
        report.skipped.push(`${rowLabel(c)}: ${row.skipReason}`);
        continue;
      }
      if (decision === "skip") {
        report.skipped.push(`${rowLabel(c)}: skipped during review`);
        continue;
      }
      const fields = incomingFields(tx, c, report.categoriesCreated);
      let channelId: number;
      if (!row.existing) {
        channelId = tx.insert(channels).values({ countryCode: code, ...fields }).returning().get().id;
        report.created.push(c.name);
        report.importedChannelIds.push(channelId);
        touched.push(channelId);
      } else {
        channelId = row.existing.id;
        const current = tx.select().from(channels).where(eq(channels.id, channelId)).get()!;
        if (decision === "update") {
          const logoChanged = current.logo !== fields.logo;
          tx.update(channels)
            .set({
              ...fields,
              logoStatus: logoChanged ? fields.logoStatus : current.logoStatus,
              ...(logoChanged ? { logoError: null, logoHttpStatus: null, logoFlagged: false, logoFlagNote: null } : {}),
              updatedAt: new Date(),
            })
            .where(eq(channels.id, channelId))
            .run();
          report.updated.push(c.name);
          touched.push(channelId);
          if (logoChanged) report.importedChannelIds.push(channelId);
        } else if (decision === "merge") {
          const logo = current.logo || fields.logo;
          tx.update(channels)
            .set({
              keywords: normalizeKeywords([...current.keywords, ...fields.keywords]),
              epgIds: cleanList([...current.epgIds, ...fields.epgIds]),
              logo,
              logoStatus: current.logo ? current.logoStatus : fields.logoStatus,
              categoryId: current.categoryId ?? fields.categoryId,
              updatedAt: new Date(),
            })
            .where(eq(channels.id, channelId))
            .run();
          report.merged.push(c.name);
          touched.push(channelId);
          if (!current.logo && logo) report.importedChannelIds.push(channelId);
        } else {
          report.reused.push(c.name);
          // In a lineup the existing channel is still linked, so it counts for completeness.
          if (lineup) touched.push(channelId);
        }
      }
      if (lineup) tx.insert(lineupEntries).values({ lineupId: lineup.id, channelId, dial: c.dial! }).run();
    }
    for (const id of touched) {
      const ch = getChannel(tx, id);
      if (ch?.issues.length) report.incomplete.push(`${ch.name}: ${ch.issues.join(", ")}`);
    }
    return report;
  });
}
