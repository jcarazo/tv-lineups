import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listLineups } from "@/lib/data/lineups";
import { getDb } from "@/lib/db/client";
import { lineupFileName } from "@/lib/domain/export";
import { CreateLineupButton, ExportAllButton, LineupActions } from "./lineup-forms";

export default async function LineupsPage(props: PageProps<"/countries/[cc]/lineups">) {
  const { cc } = await props.params;
  const code = cc.toUpperCase();
  const lineups = listLineups(getDb(), code);

  return (
    <>
      <PageHeader
        title="Lineups"
        description="Each lineup is exported as its own JSON file."
        actions={
          <>
            {lineups.length > 0 && <ExportAllButton countryCode={code} />}
            <CreateLineupButton cc={cc} />
          </>
        }
      />
      {lineups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No lineups yet. Create one, or <Link href="/import" className="underline">import a file</Link>.
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y p-0">
            {lineups.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-4 py-3">
                <Link href={`/countries/${cc}/lineups/${l.slug}`} className="flex-1">
                  <div className="font-medium hover:underline">{l.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {l.entryCount} channels · <code>{lineupFileName(code, l.slug)}</code>
                  </div>
                </Link>
                <LineupActions cc={cc} lineup={l} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
