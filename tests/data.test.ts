import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type DB } from "@/lib/db/client";
import { listCategories } from "@/lib/data/categories";
import { channelUsage, createChannel, deleteChannel, getChannel, listChannels, updateChannel } from "@/lib/data/channels";
import { createCountry, listCountries } from "@/lib/data/countries";
import { DomainError } from "@/lib/data/errors";
import { prepareExport, writeExport } from "@/lib/data/exporter";
import { applyImport, parseImportFile, planImport } from "@/lib/data/importer";
import { addEntries, createLineup, duplicateLineup, listEntries, listLineups, updateDial } from "@/lib/data/lineups";
import { suggestDials } from "@/lib/domain/dials";
import { channelInputSchema } from "@/lib/domain/validation";

const legacyText = fs.readFileSync(path.join(__dirname, "fixtures/lineup-es.json"), "utf8");
let db: DB;

beforeEach(() => {
  db = openDatabase(":memory:");
});

function input(name: string, extra: Partial<Record<string, unknown>> = {}) {
  return channelInputSchema.parse({
    name,
    logo: "https://example.com/logo.svg",
    keywords: [name.toLowerCase()],
    epgIds: [`${name}.es`],
    categoryId: listCategories(db)[0].id,
    ...extra,
  });
}

describe("countries & channels", () => {
  it("seeds default categories", () => {
    expect(listCategories(db).map((c) => c.name)).toContain("Documentaries");
  });

  it("creates countries only from ISO codes", () => {
    expect(createCountry(db, "es")).toEqual({ code: "ES", name: "Spain" });
    expect(() => createCountry(db, "XX")).toThrow(DomainError);
    expect(() => createCountry(db, "ES")).toThrow(/already exists/);
  });

  it("keeps channel names unique per country, case-insensitively", () => {
    createCountry(db, "ES");
    createCountry(db, "PT");
    createChannel(db, "ES", input("La 1"));
    expect(() => createChannel(db, "ES", input("la 1"))).toThrow(/already exists/);
    expect(() => createChannel(db, "PT", input("La 1"))).not.toThrow();
  });

  it("stores keywords uppercased", () => {
    createCountry(db, "ES");
    const c = createChannel(db, "ES", input("Cuatro", { keywords: ["cuatro", "Cuatro TV", "CUATRO"] }));
    expect(c.keywords).toEqual(["CUATRO", "CUATRO TV"]);
  });

  it("resets logo status when the logo changes", () => {
    createCountry(db, "ES");
    const c = createChannel(db, "ES", input("Neox"));
    const r = updateChannel(db, c.id, input("Neox", { logo: "https://example.com/other.svg" }));
    expect(r.logoChanged).toBe(true);
    expect(r.channel.logoStatus).toBe("unchecked");
  });
});

describe("lineups", () => {
  beforeEach(() => createCountry(db, "ES"));

  it("enforces unique dials and channels per lineup, and allows different dials across lineups", () => {
    const a = createChannel(db, "ES", input("A"));
    const b = createChannel(db, "ES", input("B"));
    const l1 = createLineup(db, "ES", "Movistar");
    addEntries(db, l1.id, [{ channelId: a.id, dial: 1 }]);
    expect(() => addEntries(db, l1.id, [{ channelId: b.id, dial: 1 }])).toThrow(/Dial 1/);
    expect(() => addEntries(db, l1.id, [{ channelId: a.id, dial: 2 }])).toThrow(/already in this lineup/);
    addEntries(db, l1.id, [{ channelId: b.id, dial: 2 }]);
    expect(() => updateDial(db, listEntries(db, l1.id)[1].entryId, 1)).toThrow(/already taken/);

    const l2 = duplicateLineup(db, l1.id, "Orange");
    updateDial(db, listEntries(db, l2.id)[0].entryId, 101);
    expect(listEntries(db, l1.id).map((e) => e.dial)).toEqual([1, 2]);
    expect(listEntries(db, l2.id).map((e) => e.dial)).toEqual([2, 101]);
  });

  it("rejects channels from another country", () => {
    createCountry(db, "PT");
    const pt = createChannel(db, "PT", input("RTP1"));
    const l = createLineup(db, "ES", "Main");
    expect(() => addEntries(db, l.id, [{ channelId: pt.id, dial: 1 }])).toThrow(/country/);
  });

  it("rejects duplicate slugs and accepts a custom one", () => {
    createLineup(db, "ES", "Spain Legacy");
    expect(() => createLineup(db, "ES", "spain  legacy!")).toThrow(/slug/);
    expect(createLineup(db, "ES", "Spain Legacy 2", "Legacy").slug).toBe("legacy");
  });

  it("reports correct counts", () => {
    const a = createChannel(db, "ES", input("A"));
    const b = createChannel(db, "ES", input("B"));
    const l1 = createLineup(db, "ES", "One");
    const l2 = createLineup(db, "ES", "Two");
    addEntries(db, l1.id, [{ channelId: a.id, dial: 1 }, { channelId: b.id, dial: 2 }]);
    addEntries(db, l2.id, [{ channelId: a.id, dial: 5 }]);
    expect(listLineups(db, "ES").map((l) => [l.name, l.entryCount])).toEqual([["One", 2], ["Two", 1]]);
    expect(Object.fromEntries(listChannels(db, "ES").map((c) => [c.name, c.lineupCount]))).toEqual({ A: 2, B: 1 });
    expect(listCountries(db)).toMatchObject([{ code: "ES", channelCount: 2, lineupCount: 2 }]);
    expect(listCategories(db)[0].usage).toBe(2);
  });

  it("cascades channel deletion to lineups", () => {
    const a = createChannel(db, "ES", input("A"));
    const l = createLineup(db, "ES", "Main");
    addEntries(db, l.id, [{ channelId: a.id, dial: 7 }]);
    expect(channelUsage(db, a.id)).toHaveLength(1);
    deleteChannel(db, a.id);
    expect(listEntries(db, l.id)).toHaveLength(0);
  });

  it("suggests the next free dials", () => {
    expect(suggestDials([1, 2, 10], 3)).toEqual([11, 12, 13]);
    expect(suggestDials([], 2)).toEqual([1, 2]);
  });
});

describe("import / export", () => {
  it("imports the legacy file and round-trips its channels", () => {
    const file = parseImportFile(legacyText);
    const plan = planImport(db, file, file.country);
    expect(plan.countryExists).toBe(false);
    expect(plan.rows.every((r) => r.existing === null && r.skipReason === null)).toBe(true);

    const report = applyImport(db, { file, countryCode: "ES", lineupName: "Spain Legacy", lineupSlug: "legacy", decisions: {} });
    expect(report.created).toHaveLength(65);
    expect(report.countryCreated).toBe(true);
    expect(report.lineupSlug).toBe("legacy");
    expect(report.incomplete).toEqual(["8: Missing logo, No EPG ids"]);
    expect(prepareExport(db, report.lineupId!).fileName).toBe("lineup-es-legacy.json");

    const incomplete = listChannels(db, "ES").filter((c) => c.issues.length);
    expect(incomplete.map((c) => c.name)).toEqual(["8"]);
    expect(incomplete[0].logoStatus).toBe("missing");

    const preview = prepareExport(db, report.lineupId!);
    expect(preview.blockers).toHaveLength(1);
    expect(preview.warnings.some((w) => w.includes("National.Geographic.Wild.HD.es"))).toBe(true);
    const exported = JSON.parse(preview.content);
    const original = JSON.parse(legacyText);
    expect(exported.channels).toEqual(original.channels);
    expect(exported.name).toBe("Spain Legacy");
    expect(preview.content).toBe(legacyText.replace('"name": "Spain"', '"name": "Spain Legacy"'));
  });

  it("blocks export until incomplete channels are fixed, then writes the file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lineups-"));
    process.env.EXPORT_DIR = dir;
    const file = parseImportFile(legacyText);
    const report = applyImport(db, { file, countryCode: "ES", lineupName: "Legacy", decisions: {} });
    expect(() => writeExport(db, report.lineupId!)).toThrow(/blocked/);

    const ch8 = listChannels(db, "ES").find((c) => c.name === "8")!;
    updateChannel(db, ch8.id, input("8", { logo: "https://example.com/8.svg", keywords: ["8"], epgIds: ["8.es"], categoryId: ch8.categoryId }));
    expect(getChannel(db, ch8.id)!.issues).toEqual([]);
    const written = writeExport(db, report.lineupId!);
    expect(written.fileName).toBe("lineup-es-legacy.json");
    expect(fs.readFileSync(path.join(dir, "lineup-es-legacy.json"), "utf8")).toBe(written.content);
    delete process.env.EXPORT_DIR;
  });

  it("imports channels only, without dials or a lineup", () => {
    createCountry(db, "CZ");
    createChannel(db, "CZ", input("Nova", { keywords: ["NOVA"], epgIds: ["Nova.cz"] }));
    const file = parseImportFile(
      JSON.stringify({
        format: "channels",
        version: 1,
        country: "CZ",
        channels: [
          { name: "ČT1", logo: "https://example.com/ct1.svg", keywords: ["čt1", "CT1"], epg_ids: ["ČT1.cz"], category: "Generalist" },
          { name: "Nova", keywords: ["NOVA TV"], epg_ids: ["Nova.TV.cz"], category: "Generalist" },
          { name: "Prima", keywords: ["PRIMA"], category: "Generalist" },
          { name: "Óčko", keywords: ["OCKO"], epg_ids: ["Óčko.cz"], category: "Music" },
          { name: "čt1", keywords: ["DUP"] },
        ],
      }),
    );
    const plan = planImport(db, file, "CZ");
    expect(plan.mode).toBe("channels");
    expect(plan.rows.map((r) => r.skipReason)).toEqual([null, null, null, null, 'Channel "čt1" appears earlier in the file']);
    expect(plan.rows[1].existing?.name).toBe("Nova");
    // A lineup can't be built from a file without dials.
    expect(planImport(db, file, "CZ", "lineup").rows[0].skipReason).toBe("No dial");

    const report = applyImport(db, { file, countryCode: "CZ", decisions: { 1: "merge", 3: "skip" } });
    expect(report).toMatchObject({ mode: "channels", lineupId: null, created: ["ČT1", "Prima"], merged: ["Nova"] });
    expect(report.skipped).toHaveLength(2);
    expect(report.incomplete).toEqual(["Prima: Missing logo, No EPG ids"]);
    expect(listLineups(db, "CZ")).toHaveLength(0);
    const byName = Object.fromEntries(listChannels(db, "CZ").map((c) => [c.name, c]));
    expect(Object.keys(byName).sort()).toEqual(["Nova", "Prima", "ČT1"]);
    expect(byName["ČT1"].keywords).toEqual(["ČT1", "CT1"]);
    expect(byName["Nova"].epgIds).toEqual(["Nova.cz", "Nova.TV.cz"]);
  });

  it("leaves existing channels untouched with 'use' in channels mode", () => {
    createCountry(db, "ES");
    createChannel(db, "ES", input("La 1", { keywords: ["OLD"] }));
    const file = parseImportFile(legacyText);
    const report = applyImport(db, { file, countryCode: "ES", mode: "channels", decisions: {} });
    expect(report.lineupId).toBeNull();
    expect(report.reused).toEqual(["La 1"]);
    expect(report.created).toHaveLength(64);
    expect(listChannels(db, "ES").find((c) => c.name === "La 1")!.keywords).toEqual(["OLD"]);
    expect(listLineups(db, "ES")).toHaveLength(0);
  });

  it("offers use/update/merge for channels that already exist", () => {
    createCountry(db, "ES");
    createChannel(db, "ES", input("La 1", { keywords: ["OLD"], epgIds: ["Old.es"] }));
    createChannel(db, "ES", input("La 2", { keywords: ["OLD"] }));
    createChannel(db, "ES", input("Antena 3", { keywords: ["OLD"] }));
    const file = parseImportFile(legacyText);
    const plan = planImport(db, file, "ES");
    const idx = (n: string) => plan.rows.find((r) => r.incoming.name === n)!.index;
    expect(plan.rows.filter((r) => r.existing)).toHaveLength(3);

    applyImport(db, {
      file,
      countryCode: "ES",
      lineupName: "Legacy",
      decisions: { [idx("La 1")]: "merge", [idx("La 2")]: "update", [idx("Antena 3")]: "use" },
    });
    const byName = Object.fromEntries(listChannels(db, "ES").map((c) => [c.name, c]));
    expect(byName["La 1"].keywords).toEqual(["OLD", "LA 1", "TVE 1", "LA1", "TVE1", "LA PRIMERA"]);
    expect(byName["La 1"].epgIds).toContain("Old.es");
    expect(byName["La 2"].keywords).toEqual(["LA 2", "TVE 2", "LA2", "TVE2", "LA DOS"]);
    expect(byName["Antena 3"].keywords).toEqual(["OLD"]);
  });
});
