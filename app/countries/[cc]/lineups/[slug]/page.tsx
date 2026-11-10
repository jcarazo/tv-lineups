import { notFound } from "next/navigation";
import { listChannels } from "@/lib/data/channels";
import { getLineupBySlug, lineupWarnings, listEntries } from "@/lib/data/lineups";
import { getDb } from "@/lib/db/client";
import { lineupFileName } from "@/lib/domain/export";
import { LineupBoard } from "./lineup-board";

export default async function LineupPage(props: PageProps<"/countries/[cc]/lineups/[slug]">) {
  const { cc, slug } = await props.params;
  const db = getDb();
  const lineup = getLineupBySlug(db, cc.toUpperCase(), slug);
  if (!lineup) notFound();

  const entries = listEntries(db, lineup.id);
  const inLineup = new Set(entries.map((e) => e.channelId));
  const available = listChannels(db, lineup.countryCode)
    .filter((c) => !inLineup.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, logo: c.logo, categoryName: c.categoryName, issues: c.issues }));

  return (
    <LineupBoard
      cc={cc}
      lineup={{ id: lineup.id, name: lineup.name, slug: lineup.slug, fileName: lineupFileName(lineup.countryCode, lineup.slug) }}
      entries={entries}
      warnings={lineupWarnings(entries)}
      available={available}
    />
  );
}
