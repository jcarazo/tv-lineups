import { asc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { categories, channels } from "../db/schema";
import { DomainError } from "./errors";

export function listCategories(db: DB) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
      usage: sql<number>`(select count(*) from channels c where c.category_id = "categories"."id")`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

function findByName(db: DB, name: string) {
  return db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name})`)
    .get();
}

export function createCategory(db: DB, rawName: string) {
  const name = rawName.trim();
  if (!name) throw new DomainError("Name is required", "name");
  if (findByName(db, name)) throw new DomainError(`Category "${name}" already exists`, "name");
  const max = db.select({ m: sql<number>`coalesce(max(${categories.sortOrder}), -1)` }).from(categories).get();
  return db
    .insert(categories)
    .values({ name, sortOrder: (max?.m ?? -1) + 1 })
    .returning()
    .get();
}

/** Returns the id of the category with this name, creating it if needed. */
export function ensureCategory(db: DB, name: string): { id: number; created: boolean } {
  const existing = findByName(db, name.trim());
  if (existing) return { id: existing.id, created: false };
  return { id: createCategory(db, name).id, created: true };
}

export function renameCategory(db: DB, id: number, rawName: string) {
  const name = rawName.trim();
  if (!name) throw new DomainError("Name is required", "name");
  const clash = findByName(db, name);
  if (clash && clash.id !== id) throw new DomainError(`Category "${name}" already exists`, "name");
  db.update(categories).set({ name }).where(eq(categories.id, id)).run();
}

export function deleteCategory(db: DB, id: number) {
  const used = db.select({ n: sql<number>`count(*)` }).from(channels).where(eq(channels.categoryId, id)).get();
  if (used && used.n > 0) {
    throw new DomainError(`Category is used by ${used.n} channel(s) and cannot be deleted`);
  }
  db.delete(categories).where(eq(categories.id, id)).run();
}

/** Swaps the category with its neighbour in the given direction. */
export function moveCategory(db: DB, id: number, direction: "up" | "down") {
  const list = listCategories(db);
  const i = list.findIndex((c) => c.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  db.transaction((tx) => {
    list.forEach((c, idx) => {
      const order = idx === i ? j : idx === j ? i : idx;
      tx.update(categories).set({ sortOrder: order }).where(eq(categories.id, c.id)).run();
    });
  });
}
