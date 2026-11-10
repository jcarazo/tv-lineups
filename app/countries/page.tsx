import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listCountries } from "@/lib/data/countries";
import { getDb } from "@/lib/db/client";
import { ISO_COUNTRIES } from "@/lib/iso-countries";
import { AddCountry, DeleteCountry } from "./country-forms";

export default function CountriesPage() {
  const countries = listCountries(getDb());
  const taken = new Set(countries.map((c) => c.code));
  const available = ISO_COUNTRIES.filter((c) => !taken.has(c.code));

  return (
    <>
      <PageHeader
        title="Countries"
        description="Each country owns its channels and any number of lineups."
        actions={<AddCountry options={available} />}
      />
      {countries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No countries yet. Add one above, or{" "}
            <Link href="/import" className="underline">import a lineup file</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((c) => (
            <Card key={c.code} className="transition-colors hover:border-foreground/30">
              <CardContent className="flex items-center justify-between gap-3">
                <Link href={`/countries/${c.code.toLowerCase()}`} className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c.code}</span>
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {c.channelCount} channels · {c.lineupCount} lineups
                  </div>
                </Link>
                <DeleteCountry code={c.code} name={c.name} channelCount={c.channelCount} lineupCount={c.lineupCount} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
