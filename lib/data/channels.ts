import { and, asc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { categories, channels, lineupEntries, lineups, type Channel } from "../db/schema";
import { channelIssues, type ChannelInput } from "../domain/validation";
import { DomainError } from "./errors";

export type ChannelView = Channel & {
  categoryName: string | null;
  issues: string[];
  lineupCount: number;
};

function withView(row: Channel & { categoryName: string | null; lineupCount: number }): ChannelView {
  return { ...row, issues: channelIssues(row) };
}

const viewColumns = {
  categoryName: categories.name,
  lineupCount: sql<number>`(select count(*) from lineup_entries e where e.channel_id = "channels"."id")`,
};

export function listChannels(db: DB, countryCode: string): ChannelView[] {
  return db
    .select({ ...getTableColumns(channels), ...viewColumns })
    .from(channels)
    .leftJoin(categories, eq(categories.id, channels.categoryId))
    .where(eq(channels.countryCode, countryCode))
    .orderBy(asc(sql`lower(${channels.name})`))
    .all()
    .map(withView);
}

export function getChannel(db: DB, id: number): ChannelView | undefined {
  const row = db
    .select({ ...getTableColumns(channels), ...viewColumns })
    .from(channels)
    .leftJoin(categories, eq(categories.id, channels.categoryId))
    .where(eq(channels.id, id))
    .get();
  return row && withView(row);
}

function assertNameFree(db: DB, countryCode: string, name: string, exceptId?: number) {
  const clash = db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.countryCode, countryCode),
        sql`lower(${channels.name}) = lower(${name})`,
        exceptId ? ne(channels.id, exceptId) : undefined,
      ),
    )
    .get();
  if (clash) throw new DomainError(`A channel named "${name}" already exists in this country`, "name");
}

export function findChannelByName(db: DB, countryCode: string, name: string) {
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.countryCode, countryCode), sql`lower(${channels.name}) = lower(${name.trim()})`))
    .get();
}

export function createChannel(db: DB, countryCode: string, input: ChannelInput): Channel {
  assertNameFree(db, countryCode, input.name);
  return db
    .insert(channels)
    .values({ countryCode, ...input, logoStatus: "unchecked" })
    .returning()
    .get();
}

/** Returns the updated channel and whether the logo URL changed (so it can be re-checked). */
export function updateChannel(db: DB, id: number, input: ChannelInput) {
  const current = db.select().from(channels).where(eq(channels.id, id)).get();
  if (!current) throw new DomainError("Channel not found");
  assertNameFree(db, current.countryCode, input.name, id);
  const logoChanged = current.logo !== input.logo;
  const updated = db
    .update(channels)
    .set({
      ...input,
      updatedAt: new Date(),
      ...(logoChanged
        ? { logoStatus: "unchecked" as const, logoError: null, logoHttpStatus: null, logoContentType: null, logoFlagged: false, logoFlagNote: null }
        : {}),
    })
    .where(eq(channels.id, id))
    .returning()
    .get();
  return { channel: updated, logoChanged };
}

/** Lineups that contain the channel; shown before a cascading delete. */
export function channelUsage(db: DB, id: number) {
  return db
    .select({ lineupId: lineups.id, lineupName: lineups.name, slug: lineups.slug, dial: lineupEntries.dial })
    .from(lineupEntries)
    .innerJoin(lineups, eq(lineups.id, lineupEntries.lineupId))
    .where(eq(lineupEntries.channelId, id))
    .orderBy(asc(lineups.name))
    .all();
}

export function deleteChannel(db: DB, id: number) {
  db.delete(channels).where(eq(channels.id, id)).run();
}

export function setLogoFlag(db: DB, id: number, flagged: boolean, note: string | null) {
  db.update(channels)
    .set({ logoFlagged: flagged, logoFlagNote: flagged ? note?.trim() || null : null })
    .where(eq(channels.id, id))
    .run();
}
