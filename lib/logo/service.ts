import { eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import { channels, lineupEntries } from "../db/schema";
import { checkLogoUrl } from "./check";

const CONCURRENCY = 5;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Checks the given channels' logos and stores the outcome on each channel. */
export async function checkChannelLogos(db: DB, channelIds: number[]) {
  if (channelIds.length === 0) return { checked: 0, broken: 0 };
  const rows = db
    .select({ id: channels.id, logo: channels.logo })
    .from(channels)
    .where(inArray(channels.id, channelIds))
    .all();
  let broken = 0;
  await mapLimit(rows, CONCURRENCY, async (row) => {
    const now = new Date();
    if (!row.logo?.trim()) {
      db.update(channels)
        .set({ logoStatus: "missing", logoHttpStatus: null, logoContentType: null, logoError: "No logo URL", logoCheckedAt: now })
        .where(eq(channels.id, row.id))
        .run();
      broken++;
      return;
    }
    const r = await checkLogoUrl(row.logo);
    if (!r.ok) broken++;
    db.update(channels)
      .set({
        logoStatus: r.ok ? "ok" : "broken",
        logoHttpStatus: r.httpStatus,
        logoContentType: r.contentType,
        logoError: r.error,
        logoCheckedAt: now,
      })
      .where(eq(channels.id, row.id))
      .run();
  });
  return { checked: rows.length, broken };
}

export function channelIdsForLineup(db: DB, lineupId: number): number[] {
  return db
    .select({ id: lineupEntries.channelId })
    .from(lineupEntries)
    .where(eq(lineupEntries.lineupId, lineupId))
    .all()
    .map((r) => r.id);
}

export function channelIdsForCountry(db: DB, countryCode: string): number[] {
  return db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.countryCode, countryCode))
    .all()
    .map((r) => r.id);
}

export function allChannelIds(db: DB): number[] {
  return db.select({ id: channels.id }).from(channels).all().map((r) => r.id);
}
