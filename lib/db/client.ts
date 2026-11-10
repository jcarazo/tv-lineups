import fs from "node:fs";
import path from "node:path";
import Database, { type RunResult } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { DEFAULT_CATEGORIES } from "../domain/constants";

/** A database or a transaction: both can be passed to repository functions. */
export type DB = BaseSQLiteDatabase<"sync", RunResult, typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "lib/db/migrations");

/** Opens a database, runs pending migrations and seeds the default categories. */
export function openDatabase(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  if (db.select().from(schema.categories).all().length === 0) {
    db.insert(schema.categories)
      .values(DEFAULT_CATEGORIES.map((name, i) => ({ name, sortOrder: i })))
      .run();
  }
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  if (!globalForDb.__db) {
    globalForDb.__db = openDatabase(
      process.env.DATABASE_URL ?? path.join(process.cwd(), "data/app.db"),
    );
  }
  return globalForDb.__db;
}
