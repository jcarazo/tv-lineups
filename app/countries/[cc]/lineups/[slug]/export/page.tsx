import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prepareExport } from "@/lib/data/exporter";
import { getLineupBySlug } from "@/lib/data/lineups";
import { getDb } from "@/lib/db/client";
import { ExportPanel } from "./export-panel";

export default async function ExportPage(props: PageProps<"/countries/[cc]/lineups/[slug]/export">) {
  const { cc, slug } = await props.params;
  const db = getDb();
  const lineup = getLineupBySlug(db, cc.toUpperCase(), slug);
  if (!lineup) notFound();

  return (
    <>
      <PageHeader
        title={<>Export · {lineup.name}</>}
        description={
          <Link href={`/countries/${cc}/lineups/${slug}`} className="hover:underline">
            ← Back to lineup
          </Link>
        }
      />
      <ExportPanel initial={prepareExport(db, lineup.id)} />
    </>
  );
}
