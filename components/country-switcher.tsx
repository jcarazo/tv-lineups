"use client";

import { useParams, useRouter } from "next/navigation";

/** Header filter: jump to a country's workspace, or to the overview of all countries. */
export function CountrySwitcher({ countries }: { countries: { code: string; name: string }[] }) {
  const router = useRouter();
  const params = useParams<{ cc?: string }>();
  const current = params.cc?.toUpperCase() ?? "";

  return (
    <select
      aria-label="Country"
      className="h-8 rounded-lg border bg-background px-2 text-sm"
      value={current}
      onChange={(e) => router.push(e.target.value ? `/countries/${e.target.value.toLowerCase()}` : "/countries")}
    >
      <option value="">All countries</option>
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} · {c.name}
        </option>
      ))}
    </select>
  );
}
