import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLineupJson, lineupFileName, serializeLineup, sharedEpgIds } from "@/lib/domain/export";
import { channelInputSchema, channelIssues, normalizeKeywords, slugify } from "@/lib/domain/validation";
import { looksLikeSvg } from "@/lib/logo/check";

const legacy = fs.readFileSync(path.join(__dirname, "fixtures/lineup-es.json"), "utf8");

describe("normalization", () => {
  it("uppercases, trims and de-duplicates keywords", () => {
    expect(normalizeKeywords([" la 1", "LA 1", "tve1", "", "TVE1 "])).toEqual(["LA 1", "TVE1"]);
  });

  it("slugifies names with accents", () => {
    expect(slugify("Spain Legacy")).toBe("spain-legacy");
    expect(slugify("Cine Español por M+")).toBe("cine-espanol-por-m");
    expect(lineupFileName("ES", "legacy")).toBe("lineup-es-legacy.json");
  });

  it("requires every channel field", () => {
    const r = channelInputSchema.safeParse({ name: " ", logo: "nope", keywords: [], epgIds: [" "], categoryId: "" });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "logo", "keywords", "epgIds", "categoryId"]));
  });
});

describe("legacy file", () => {
  const file = JSON.parse(legacy);

  it("flags channel 8 as incomplete", () => {
    const ch8 = file.channels.find((c: { dial: number }) => c.dial === 8);
    expect(
      channelIssues({ name: ch8.name, logo: ch8.logo ?? null, keywords: ch8.keywords, epgIds: ch8.epg_ids ?? [], categoryId: 1 }),
    ).toEqual(["Missing logo", "No EPG ids"]);
  });

  it("detects the shared Nat Geo Wild EPG id", () => {
    const shared = sharedEpgIds(file.channels.map((c: { name: string; epg_ids?: string[] }) => ({ name: c.name, epgIds: c.epg_ids ?? [] })));
    expect([...shared.keys()]).toEqual(["National.Geographic.Wild.HD.es"]);
  });

  it("serializes byte-identically", () => {
    const rebuilt = buildLineupJson(
      file.country,
      file.name,
      file.channels.map((c: { dial: number; name: string; logo?: string; keywords?: string[]; epg_ids?: string[]; category?: string }) => ({
        dial: c.dial,
        name: c.name,
        logo: c.logo ?? null,
        keywords: c.keywords ?? [],
        epgIds: c.epg_ids ?? [],
        category: c.category ?? null,
      })),
    );
    expect(serializeLineup(rebuilt)).toBe(legacy);
  });
});

describe("svg detection", () => {
  it("accepts svg documents and rejects html", () => {
    expect(looksLikeSvg('<?xml version="1.0"?>\n<!-- x --><svg xmlns="http://www.w3.org/2000/svg"></svg>\n')).toBe(true);
    expect(looksLikeSvg("<!DOCTYPE html><html><body>404</body></html>")).toBe(false);
  });
});
