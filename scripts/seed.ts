/**
 * Imports lineup-es.json as the "Spain Legacy" lineup (file lineup-es-legacy.json).
 * Safe to re-run: does nothing if that lineup already exists.
 *
 *   npm run seed [-- path/to/lineup.json]
 */
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../lib/db/client";
import { applyImport, parseImportFile } from "../lib/data/importer";
import { getLineupBySlug } from "../lib/data/lineups";
import { checkChannelLogos } from "../lib/logo/service";

async function main() {
  const source = path.resolve(process.argv[2] ?? "lineup-es.json");
  const db = openDatabase(process.env.DATABASE_URL ?? path.join(process.cwd(), "data/app.db"));
  const file = parseImportFile(fs.readFileSync(source, "utf8"));

  if (getLineupBySlug(db, file.country, "legacy")) {
    console.log(`Lineup ${file.country}/legacy already exists, nothing to do.`);
    return;
  }
  const report = applyImport(db, {
    file,
    countryCode: file.country,
    lineupName: "Spain Legacy",
    lineupSlug: "legacy",
    decisions: {},
  });
  console.log(`Imported ${report.created.length} new, ${report.reused.length} existing channels into ${report.countryCode}/legacy.`);
  if (report.incomplete.length) console.log(`Incomplete: ${report.incomplete.join("; ")}`);

  const logos = await checkChannelLogos(db, report.importedChannelIds);
  console.log(`Logos: ${logos.checked} checked, ${logos.broken} broken or missing.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
