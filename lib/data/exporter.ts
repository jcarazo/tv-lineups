import fs from "node:fs";
import path from "node:path";
import type { DB } from "../db/client";
import { buildLineupJson, lineupFileName, serializeLineup } from "../domain/export";
import { DomainError } from "./errors";
import { getLineup, lineupWarnings, listEntries } from "./lineups";

/** Defaults to the repo's lineups/ folder; Docker mounts it at /export. */
export function exportDir(): string {
  return process.env.EXPORT_DIR ?? path.join(process.cwd(), "lineups");
}

export interface ExportPreview {
  lineupId: number;
  fileName: string;
  filePath: string;
  content: string;
  onDisk: string | null;
  unchanged: boolean;
  /** Incomplete channels: export is not allowed while any exist. */
  blockers: string[];
  /** Broken/missing/flagged logos and shared EPG ids: export allowed. */
  warnings: string[];
}

export function prepareExport(db: DB, lineupId: number): ExportPreview {
  const lineup = getLineup(db, lineupId);
  if (!lineup) throw new DomainError("Lineup not found");
  const entries = listEntries(db, lineupId);

  const blockers = entries
    .filter((e) => e.issues.length)
    .map((e) => `Dial ${e.dial} · ${e.name}: ${e.issues.join(", ")}`);
  if (entries.length === 0) blockers.push("The lineup has no channels");

  const warnings = [
    ...entries
      .filter((e) => e.logo && e.logoStatus === "broken")
      .map((e) => `Dial ${e.dial} · ${e.name}: logo broken (${e.logoError ?? "unknown error"})`),
    ...entries
      .filter((e) => e.logo && e.logoStatus === "unchecked")
      .map((e) => `Dial ${e.dial} · ${e.name}: logo not checked yet`),
    ...entries
      .filter((e) => e.logoFlagged)
      .map((e) => `Dial ${e.dial} · ${e.name}: logo flagged as looking wrong${e.logoFlagNote ? ` (${e.logoFlagNote})` : ""}`),
    ...lineupWarnings(entries),
  ];

  const content = serializeLineup(
    buildLineupJson(
      lineup.countryCode,
      lineup.name,
      entries.map((e) => ({
        dial: e.dial,
        name: e.name,
        logo: e.logo,
        keywords: e.keywords,
        epgIds: e.epgIds,
        category: e.categoryName,
      })),
    ),
  );
  const fileName = lineupFileName(lineup.countryCode, lineup.slug);
  const filePath = path.join(exportDir(), fileName);
  const onDisk = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;

  return { lineupId, fileName, filePath, content, onDisk, unchanged: onDisk === content, blockers, warnings };
}

/** Writes the lineup file. Never deletes or renames other files. */
export function writeExport(db: DB, lineupId: number): ExportPreview {
  const preview = prepareExport(db, lineupId);
  if (preview.blockers.length) {
    throw new DomainError(`Export blocked: ${preview.blockers.length} issue(s) must be fixed first`);
  }
  fs.mkdirSync(path.dirname(preview.filePath), { recursive: true });
  fs.writeFileSync(preview.filePath, preview.content, "utf8");
  return { ...preview, onDisk: preview.content, unchanged: true };
}
