import { notFound } from "next/navigation";
import { getCountry } from "@/lib/data/countries";
import { getDb } from "@/lib/db/client";
import { CountryTabs } from "./country-tabs";

export default async function CountryLayout(props: LayoutProps<"/countries/[cc]">) {
  const { cc } = await props.params;
  const country = getCountry(getDb(), cc);
  if (!country) notFound();
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded bg-foreground px-2 py-0.5 font-mono text-sm text-background">{country.code}</span>
        <span className="text-lg font-semibold">{country.name}</span>
        <CountryTabs cc={cc.toLowerCase()} />
      </div>
      {props.children}
    </>
  );
}
