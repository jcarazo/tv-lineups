import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const LOGO_STATUSES = ["unchecked", "ok", "broken", "missing"] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const countries = sqliteTable("countries", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamps.createdAt,
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const channels = sqliteTable(
  "channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logo: text("logo"),
    keywords: text("keywords", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    epgIds: text("epg_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    logoStatus: text("logo_status", { enum: LOGO_STATUSES })
      .notNull()
      .default("unchecked"),
    logoHttpStatus: integer("logo_http_status"),
    logoContentType: text("logo_content_type"),
    logoError: text("logo_error"),
    logoCheckedAt: integer("logo_checked_at", { mode: "timestamp" }),
    logoFlagged: integer("logo_flagged", { mode: "boolean" })
      .notNull()
      .default(false),
    logoFlagNote: text("logo_flag_note"),
    ...timestamps,
  },
  (t) => [uniqueIndex("channels_country_name").on(t.countryCode, t.name)],
);

export const lineups = sqliteTable(
  "lineups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("lineups_country_slug").on(t.countryCode, t.slug)],
);

export const lineupEntries = sqliteTable(
  "lineup_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lineupId: integer("lineup_id")
      .notNull()
      .references(() => lineups.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    dial: integer("dial").notNull(),
  },
  (t) => [
    uniqueIndex("entries_lineup_dial").on(t.lineupId, t.dial),
    uniqueIndex("entries_lineup_channel").on(t.lineupId, t.channelId),
  ],
);

export type Country = typeof countries.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Lineup = typeof lineups.$inferSelect;
export type LineupEntry = typeof lineupEntries.$inferSelect;
