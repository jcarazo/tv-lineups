import { LINEUP_FORMAT, LINEUP_VERSION } from "./constants";
import { slugify } from "./validation";

/** The consumer-facing file. */
export interface LineupJson {
  format: typeof LINEUP_FORMAT;
  version: number;
  country: string;
  name: string;
  channels: {
    dial: number;
    name: string;
    logo?: string;
    keywords?: string[];
    epg_ids?: string[];
    category?: string;
  }[];
}

export interface ExportEntry {
  dial: number;
  name: string;
  logo: string | null;
  keywords: string[];
  epgIds: string[];
  category: string | null;
}

/**
 * Builds the consumer-facing JSON object. Key order matters for stable diffs:
 * dial, name, logo, keywords, epg_ids, category. Empty optional fields are
 * omitted, as in the legacy file.
 */
export function buildLineupJson(
  countryCode: string,
  lineupName: string,
  entries: ExportEntry[],
): LineupJson {
  return {
    format: LINEUP_FORMAT,
    version: LINEUP_VERSION,
    country: countryCode.toUpperCase(),
    name: lineupName,
    channels: [...entries]
      .sort((a, b) => a.dial - b.dial)
      .map((e) => ({
        dial: e.dial,
        name: e.name,
        ...(e.logo ? { logo: e.logo } : {}),
        ...(e.keywords.length ? { keywords: e.keywords } : {}),
        ...(e.epgIds.length ? { epg_ids: e.epgIds } : {}),
        ...(e.category ? { category: e.category } : {}),
      })),
  };
}

/** 2-space indent, unescaped UTF-8, no trailing newline (matches lineup-es.json). */
export function serializeLineup(file: LineupJson): string {
  return JSON.stringify(file, null, 2);
}

export function lineupFileName(countryCode: string, slug: string): string {
  return `lineup-${countryCode.toLowerCase()}-${slugify(slug)}.json`;
}

/** epg_ids used by more than one channel in the same lineup. */
export function sharedEpgIds(
  entries: { name: string; epgIds: string[] }[],
): Map<string, string[]> {
  const byId = new Map<string, string[]>();
  for (const e of entries) {
    for (const id of e.epgIds) {
      byId.set(id, [...(byId.get(id) ?? []), e.name]);
    }
  }
  return new Map([...byId].filter(([, names]) => names.length > 1));
}
