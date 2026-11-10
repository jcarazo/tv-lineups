import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { categories, channels, lineupEntries, lineups, type Lineup } from "../db/schema";
import { sharedEpgIds } from "../domain/export";
import { channelIssues, dialSchema, lineupNameSchema, slugify } from "../domain/validation";
import { DomainError } from "./errors";

export function listLineups(db: DB, countryCode: string) {
  return db
    .select({
      id: lineups.id,
      name: lineups.name,
      slug: lineups.slug,
      updatedAt: lineups.updatedAt,
      entryCount: sql<number>`(select count(*) from lineup_entries e where e.lineup_id = "lineups"."id")`,
    })
    .from(lineups)
    .where(eq(lineups.countryCode, countryCode))
    .orderBy(asc(lineups.name))
    .all();
}

export function getLineupBySlug(db: DB, countryCode: string, slug: string) {
  return db
    .select()
    .from(lineups)
    .where(and(eq(lineups.countryCode, countryCode), eq(lineups.slug, slug)))
    .get();
}

export function getLineup(db: DB, id: number) {
  return db.select().from(lineups).where(eq(lineups.id, id)).get();
}

/** Validates the name and the file slug (defaults to the slugified name). */
function validName(db: DB, countryCode: string, rawName: string, rawSlug?: string | null, exceptId?: number) {
  const name = lineupNameSchema.parse(rawName);
  const slug = slugify(rawSlug?.trim() ? rawSlug : name);
  if (!slug) throw new DomainError("Name must contain letters or digits", "name");
  const clash = db
    .select({ id: lineups.id, name: lineups.name })
    .from(lineups)
    .where(and(eq(lineups.countryCode, countryCode), eq(lineups.slug, slug), exceptId ? ne(lineups.id, exceptId) : undefined))
    .get();
  if (clash) throw new DomainError(`Lineup "${clash.name}" already uses the file slug "${slug}"`, "name");
  return { name, slug };
}

export function createLineup(db: DB, countryCode: string, rawName: string, rawSlug?: string | null): Lineup {
  const { name, slug } = validName(db, countryCode, rawName, rawSlug);
  return db.insert(lineups).values({ countryCode, name, slug }).returning().get();
}

export function renameLineup(db: DB, id: number, rawName: string, rawSlug?: string | null): Lineup {
  const current = getLineup(db, id);
  if (!current) throw new DomainError("Lineup not found");
  const { name, slug } = validName(db, current.countryCode, rawName, rawSlug, id);
  return db.update(lineups).set({ name, slug, updatedAt: new Date() }).where(eq(lineups.id, id)).returning().get();
}

export function deleteLineup(db: DB, id: number) {
  db.delete(lineups).where(eq(lineups.id, id)).run();
}

export function duplicateLineup(db: DB, id: number, rawName: string, rawSlug?: string | null): Lineup {
  const source = getLineup(db, id);
  if (!source) throw new DomainError("Lineup not found");
  return db.transaction((tx) => {
    const copy = createLineup(tx, source.countryCode, rawName, rawSlug);
    const entries = tx.select().from(lineupEntries).where(eq(lineupEntries.lineupId, id)).all();
    if (entries.length) {
      tx.insert(lineupEntries)
        .values(entries.map((e) => ({ lineupId: copy.id, channelId: e.channelId, dial: e.dial })))
        .run();
    }
    return copy;
  });
}

function touch(db: DB, lineupId: number) {
  db.update(lineups).set({ updatedAt: new Date() }).where(eq(lineups.id, lineupId)).run();
}

export type LineupEntryView = ReturnType<typeof listEntries>[number];

/** Entries joined with their channel, sorted by dial, with validation issues. */
export function listEntries(db: DB, lineupId: number) {
  return db
    .select({
      entryId: lineupEntries.id,
      dial: lineupEntries.dial,
      channelId: channels.id,
      name: channels.name,
      logo: channels.logo,
      keywords: channels.keywords,
      epgIds: channels.epgIds,
      categoryId: channels.categoryId,
      categoryName: categories.name,
      logoStatus: channels.logoStatus,
      logoError: channels.logoError,
      logoHttpStatus: channels.logoHttpStatus,
      logoCheckedAt: channels.logoCheckedAt,
      logoFlagged: channels.logoFlagged,
      logoFlagNote: channels.logoFlagNote,
    })
    .from(lineupEntries)
    .innerJoin(channels, eq(channels.id, lineupEntries.channelId))
    .leftJoin(categories, eq(categories.id, channels.categoryId))
    .where(eq(lineupEntries.lineupId, lineupId))
    .orderBy(asc(lineupEntries.dial))
    .all()
    .map((e) => ({ ...e, issues: channelIssues(e) }));
}

export function lineupWarnings(entries: { name: string; epgIds: string[] }[]) {
  return [...sharedEpgIds(entries)].map(
    ([id, names]) => `EPG id "${id}" is shared by ${names.join(", ")}`,
  );
}

function assertChannelsInCountry(db: DB, countryCode: string, channelIds: number[]) {
  const found = db
    .select({ id: channels.id })
    .from(channels)
    .where(and(inArray(channels.id, channelIds), eq(channels.countryCode, countryCode)))
    .all();
  if (found.length !== new Set(channelIds).size) {
    throw new DomainError("Channels must belong to the lineup's country");
  }
}

/** Adds several channels at once; dials must be unique and free. */
export function addEntries(db: DB, lineupId: number, items: { channelId: number; dial: number }[]) {
  const lineup = getLineup(db, lineupId);
  if (!lineup) throw new DomainError("Lineup not found");
  if (items.length === 0) return;
  for (const it of items) dialSchema.parse(it.dial);
  assertChannelsInCountry(db, lineup.countryCode, items.map((i) => i.channelId));

  const existing = db.select().from(lineupEntries).where(eq(lineupEntries.lineupId, lineupId)).all();
  const usedDials = new Set(existing.map((e) => e.dial));
  const present = new Set(existing.map((e) => e.channelId));
  const newDials = new Set<number>();
  for (const it of items) {
    if (present.has(it.channelId)) throw new DomainError("A selected channel is already in this lineup");
    if (usedDials.has(it.dial) || newDials.has(it.dial)) throw new DomainError(`Dial ${it.dial} is already taken`);
    newDials.add(it.dial);
  }
  db.transaction((tx) => {
    tx.insert(lineupEntries).values(items.map((i) => ({ lineupId, ...i }))).run();
    touch(tx, lineupId);
  });
}

export function updateDial(db: DB, entryId: number, rawDial: unknown) {
  const dial = dialSchema.parse(rawDial);
  const entry = db.select().from(lineupEntries).where(eq(lineupEntries.id, entryId)).get();
  if (!entry) throw new DomainError("Entry not found");
  if (entry.dial === dial) return;
  const clash = db
    .select({ id: lineupEntries.id })
    .from(lineupEntries)
    .where(and(eq(lineupEntries.lineupId, entry.lineupId), eq(lineupEntries.dial, dial)))
    .get();
  if (clash) throw new DomainError(`Dial ${dial} is already taken in this lineup`, "dial");
  db.update(lineupEntries).set({ dial }).where(eq(lineupEntries.id, entryId)).run();
  touch(db, entry.lineupId);
}

export function removeEntry(db: DB, entryId: number) {
  const entry = db.select().from(lineupEntries).where(eq(lineupEntries.id, entryId)).get();
  if (!entry) return;
  db.delete(lineupEntries).where(eq(lineupEntries.id, entryId)).run();
  touch(db, entry.lineupId);
}
