import { asc, eq, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { countries } from "../db/schema";
import { isoCountryName } from "../iso-countries";
import { DomainError } from "./errors";

export function listCountries(db: DB) {
  return db
    .select({
      code: countries.code,
      name: countries.name,
      channelCount: sql<number>`(select count(*) from channels c where c.country_code = "countries"."code")`,
      lineupCount: sql<number>`(select count(*) from lineups l where l.country_code = "countries"."code")`,
    })
    .from(countries)
    .orderBy(asc(countries.name))
    .all();
}

export function getCountry(db: DB, code: string) {
  return db.select().from(countries).where(eq(countries.code, code.toUpperCase())).get();
}

export function createCountry(db: DB, code: string) {
  const upper = code.trim().toUpperCase();
  const name = isoCountryName(upper);
  if (!name) throw new DomainError(`"${code}" is not an ISO 3166 country code`, "code");
  if (getCountry(db, upper)) throw new DomainError(`${name} already exists`, "code");
  db.insert(countries).values({ code: upper, name }).run();
  return { code: upper, name };
}

/** Deletes a country with all its channels and lineups (FK cascade). */
export function deleteCountry(db: DB, code: string) {
  db.delete(countries).where(eq(countries.code, code.toUpperCase())).run();
}
