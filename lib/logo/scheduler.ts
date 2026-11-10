import cron from "node-cron";
import { getDb } from "../db/client";
import { allChannelIds, checkChannelLogos } from "./service";

const globalForCron = globalThis as unknown as { __logoCron?: boolean };

/** Re-checks every logo on a schedule (LOGO_CHECK_CRON, default daily at 03:00). */
export function startLogoScheduler() {
  if (globalForCron.__logoCron) return;
  const expr = process.env.LOGO_CHECK_CRON ?? "0 3 * * *";
  if (expr === "off") return;
  if (!cron.validate(expr)) {
    console.error(`[logo-check] invalid LOGO_CHECK_CRON "${expr}", scheduler disabled`);
    return;
  }
  globalForCron.__logoCron = true;
  cron.schedule(expr, async () => {
    const db = getDb();
    const { checked, broken } = await checkChannelLogos(db, allChannelIds(db));
    console.log(`[logo-check] scheduled run: ${checked} checked, ${broken} broken`);
  });
  console.log(`[logo-check] scheduler started (${expr})`);
}
