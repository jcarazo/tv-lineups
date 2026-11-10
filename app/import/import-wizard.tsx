"use client";

import { CheckCircle2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { applyImportAction, planImportAction } from "@/app/actions";
import { LogoTile } from "@/components/logo-tile";
import { Pill } from "@/components/status-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ConflictDecision, ImportMode, ImportPlan, ImportReport, ImportRow } from "@/lib/data/importer";
import { lineupFileName } from "@/lib/domain/export";
import { normalizeKeywords, slugify } from "@/lib/domain/validation";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";

const EXISTING_DECISIONS: Record<ImportMode, { value: ConflictDecision; label: string; hint: string }[]> = {
  lineup: [
    { value: "use", label: "Use existing", hint: "Link the existing channel, ignore imported fields" },
    { value: "update", label: "Update existing", hint: "Overwrite the existing channel with imported fields" },
    { value: "merge", label: "Merge", hint: "Union keywords & EPG ids; keep existing logo/category when set" },
    { value: "skip", label: "Skip", hint: "Leave it out of the lineup" },
  ],
  channels: [
    { value: "use", label: "Leave unchanged", hint: "Keep the existing channel as it is" },
    { value: "update", label: "Update existing", hint: "Overwrite the existing channel with imported fields" },
    { value: "merge", label: "Merge", hint: "Union keywords & EPG ids; keep existing logo/category when set" },
  ],
};

const MODES: { value: ImportMode; label: string; hint: string }[] = [
  { value: "channels", label: "Channels only", hint: "Add the channels to the country. No lineup, dials are ignored." },
  { value: "lineup", label: "Create a lineup", hint: "Also create a lineup that places the channels at the file's dials." },
];

export function ImportWizard({ countries }: { countries: { code: string; name: string }[] }) {
  const [text, setText] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [country, setCountry] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [decisions, setDecisions] = useState<Record<number, ConflictDecision>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const { pending, exec } = useAction();

  function loadPlan(content: string, cc: string | null, mode: ImportMode | null) {
    exec(() => planImportAction(content, cc, mode), {
      onSuccess: (p) => {
        if (!p) return;
        setPlan(p);
        setCountry(p.countryCode);
        setName((n) => n || p.suggestedName);
        setDecisions(Object.fromEntries(p.rows.filter((r) => r.existing).map((r) => [r.index, "use" as const])));
      },
    });
  }

  function reset() {
    setReport(null);
    setPlan(null);
    setText(null);
    setFileLabel("");
    setName("");
    setSlug("");
  }

  if (report) return <ImportResult report={report} onReset={reset} />;

  const mode = plan?.mode ?? "lineup";
  const usable = plan?.rows.filter((r) => !r.skipReason) ?? [];
  const existing = usable.filter((r) => r.existing);
  const fresh = usable.filter((r) => !r.existing);
  const invalid = plan?.rows.filter((r) => r.skipReason) ?? [];
  const willCreate = fresh.filter((r) => decisions[r.index] !== "skip").length;
  const willChange = existing.filter((r) => decisions[r.index] === "update" || decisions[r.index] === "merge").length;
  const effectiveSlug = slugify(slug || name);
  const setMany = (rows: ImportRow[], value: ConflictDecision | null) =>
    setDecisions((d) => {
      const next = { ...d };
      for (const r of rows) {
        if (value) next[r.index] = value;
        else delete next[r.index];
      }
      return next;
    });

  const canImport =
    !pending &&
    (mode === "lineup" ? !!name.trim() && usable.some((r) => decisions[r.index] !== "skip") : willCreate + willChange > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1 · Choose a file</CardTitle>
          <CardDescription>
            A lineup file (<code>&quot;format&quot;: &quot;lineup&quot;</code>) or a channels file (
            <code>&quot;format&quot;: &quot;channels&quot;</code>, no dials needed).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className={buttonVariants({ variant: "outline" })}>
            <UploadIcon /> {fileLabel || "Select JSON file"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const content = await f.text();
                e.target.value = "";
                setFileLabel(f.name);
                setText(content);
                setName("");
                setSlug("");
                setPlan(null);
                loadPlan(content, null, null);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {plan && text && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2 · Target</CardTitle>
              <CardDescription>
                {plan.rows.length} channels in the file.{" "}
                {plan.countryExists ? `${plan.countryName} already exists.` : `${plan.countryName} will be created.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What to import">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    onClick={() => mode !== m.value && loadPlan(text, country, m.value)}
                    className={cn(
                      "max-w-xs rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      mode === m.value ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40",
                    )}
                  >
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.hint}</div>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      loadPlan(text, e.target.value, mode);
                    }}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                {mode === "lineup" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Lineup name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="slug">File slug</Label>
                      <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name)} />
                      <p className="text-xs text-muted-foreground">
                        <code>{effectiveSlug ? lineupFileName(country, effectiveSlug) : "—"}</code>
                      </p>
                    </div>
                  </>
                )}
              </div>
              {plan.unknownCategories.length > 0 && (
                <p className="text-sm text-muted-foreground">New categories will be created: {plan.unknownCategories.join(", ")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3 · Review</CardTitle>
              <CardDescription>
                {fresh.length} new channel(s) · {existing.length} already exist in {plan.countryName}
                {invalid.length > 0 && ` · ${invalid.length} can't be imported`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fresh.length > 0 && (
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <h3 className="mr-2 font-medium">New channels ({willCreate} of {fresh.length} selected)</h3>
                    <Button size="sm" variant="outline" onClick={() => setMany(fresh, null)}>Create all</Button>
                    <Button size="sm" variant="outline" onClick={() => setMany(fresh, "skip")}>Skip all</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-40">Logo</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Keywords</TableHead>
                        <TableHead>EPG ids</TableHead>
                        {mode === "lineup" && <TableHead>Dial</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fresh.map((r) => {
                        const on = decisions[r.index] !== "skip";
                        return (
                          <TableRow key={r.index} className={cn(!on && "opacity-50")}>
                            <TableCell>
                              <input
                                type="checkbox"
                                aria-label={`Create ${r.incoming.name}`}
                                className="size-4 accent-foreground"
                                checked={on}
                                onChange={(e) => setMany([r], e.target.checked ? null : "skip")}
                              />
                            </TableCell>
                            <TableCell><LogoTile url={r.incoming.logo?.trim() || null} size="sm" /></TableCell>
                            <TableCell>
                              <div className="font-medium">{r.incoming.name}</div>
                              {r.incoming.category ? (
                                <span className="text-xs text-muted-foreground">{r.incoming.category}</span>
                              ) : (
                                <Pill kind="bad">Category missing</Pill>
                              )}
                            </TableCell>
                            <TableCell><Values values={normalizeKeywords(r.incoming.keywords ?? [])} /></TableCell>
                            <TableCell><Values values={r.incoming.epg_ids ?? []} /></TableCell>
                            {mode === "lineup" && <TableCell className="font-mono">{r.incoming.dial}</TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </section>
              )}

              {existing.length > 0 && (
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <h3 className="mr-2 font-medium">Already in {plan.countryName}</h3>
                    Set all to:
                    {EXISTING_DECISIONS[mode].map((d) => (
                      <Button key={d.value} size="sm" variant="outline" onClick={() => setMany(existing, d.value)}>
                        {d.label}
                      </Button>
                    ))}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {mode === "lineup" && <TableHead>Dial</TableHead>}
                        <TableHead>Channel</TableHead>
                        <TableHead>Differences</TableHead>
                        <TableHead>Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existing.map((r) => (
                        <TableRow key={r.index}>
                          {mode === "lineup" && <TableCell className="font-mono">{r.incoming.dial}</TableCell>}
                          <TableCell className="font-medium">{r.incoming.name}</TableCell>
                          <TableCell className="max-w-md text-xs"><Differences row={r} /></TableCell>
                          <TableCell>
                            <select
                              aria-label={`Decision for ${r.incoming.name}`}
                              className="h-8 rounded-lg border bg-background px-2 text-sm"
                              value={decisions[r.index] ?? "use"}
                              onChange={(e) => setMany([r], e.target.value as ConflictDecision)}
                            >
                              {EXISTING_DECISIONS[mode].map((d) => (
                                <option key={d.value} value={d.value} title={d.hint}>{d.label}</option>
                              ))}
                            </select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              )}

              {invalid.length > 0 && (
                <section>
                  <h3 className="mb-1 text-sm font-medium">Can&apos;t be imported</h3>
                  <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300">
                    {invalid.map((r) => (
                      <li key={r.index}>
                        {r.incoming.dial != null && `Dial ${r.incoming.dial} · `}
                        {r.incoming.name}: {r.skipReason}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="text-sm text-muted-foreground">
                Channels missing required fields are imported and flagged as <strong>Incomplete</strong>.
                {mode === "lineup" && " The lineup can't be exported until they are fixed."}
              </p>
              <Button
                disabled={!canImport}
                onClick={() =>
                  exec(() => applyImportAction({ text, countryCode: country, mode, lineupName: name, lineupSlug: slug, decisions }), {
                    onSuccess: (r) => r && setReport(r),
                  })
                }
              >
                {pending
                  ? "Importing and checking logos…"
                  : mode === "lineup"
                    ? "Create lineup"
                    : `Import ${willCreate} new${willChange ? ` + ${willChange} updated` : ""} channel(s)`}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Values({ values, max = 3 }: { values: string[]; max?: number }) {
  if (values.length === 0) return <Pill kind="bad">missing</Pill>;
  return (
    <span className="font-mono text-xs" title={values.join("\n")}>
      {values.slice(0, max).join(", ")}
      {values.length > max && <span className="text-muted-foreground"> +{values.length - max}</span>}
    </span>
  );
}

function Differences({ row }: { row: ImportRow }) {
  const ex = row.existing!;
  const inc = row.incoming;
  const diffs: string[] = [];
  if ((inc.logo ?? null) !== ex.logo) diffs.push("logo");
  const kw = normalizeKeywords(inc.keywords ?? []);
  const newKw = kw.filter((k) => !ex.keywords.includes(k));
  const newEpg = (inc.epg_ids ?? []).filter((e) => !ex.epgIds.includes(e));
  if (newKw.length) diffs.push(`+${newKw.length} keyword(s): ${newKw.join(", ")}`);
  if (newEpg.length) diffs.push(`+${newEpg.length} EPG id(s): ${newEpg.join(", ")}`);
  if ((inc.category ?? null) !== ex.categoryName) diffs.push(`category ${ex.categoryName ?? "—"} → ${inc.category ?? "—"}`);
  return diffs.length ? <ul className="space-y-0.5">{diffs.map((d) => <li key={d}>{d}</li>)}</ul> : <Pill kind="ok">Identical</Pill>;
}

function ImportResult({ report, onReset }: { report: ImportReport; onReset: () => void }) {
  const cc = report.countryCode.toLowerCase();
  const sections: [string, string[]][] = [
    ["Created", report.created],
    [report.mode === "lineup" ? "Linked to existing" : "Left unchanged", report.reused],
    ["Updated", report.updated],
    ["Merged", report.merged],
    ["Skipped", report.skipped],
    [report.mode === "lineup" ? "Incomplete (fix before export)" : "Incomplete (fill in the missing fields)", report.incomplete],
    ["Categories created", report.categoriesCreated],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-emerald-600" /> Import complete
        </CardTitle>
        <CardDescription>{report.countryCreated && "Country created. "}Logos of new and changed channels have been checked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {sections
            .filter(([, items]) => items.length)
            .map(([title, items]) => (
              <div key={title}>
                <div className="mb-1 text-sm font-medium">{title} ({items.length})</div>
                <div className="max-h-40 overflow-y-auto rounded border bg-muted/40 p-2 text-xs">{items.join(" · ")}</div>
              </div>
            ))}
        </div>
        <div className="flex gap-2">
          {report.lineupSlug ? (
            <Link href={`/countries/${cc}/lineups/${report.lineupSlug}`} className={buttonVariants()}>Open lineup</Link>
          ) : (
            <Link href={`/countries/${cc}/channels`} className={buttonVariants()}>Open channels</Link>
          )}
          <Button variant="outline" onClick={onReset}>Import another</Button>
        </div>
      </CardContent>
    </Card>
  );
}
