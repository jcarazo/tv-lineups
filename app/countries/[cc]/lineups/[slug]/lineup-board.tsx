"use client";

import { DownloadIcon, FlagIcon, LayoutGridIcon, ListIcon, PencilIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { removeEntryAction, renameLineupAction, setLogoFlagAction, updateDialAction } from "@/app/actions";
import { CheckLogosButton } from "@/components/check-logos-button";
import { LineupNameDialog } from "@/components/lineup-name-dialog";
import { LogoTile } from "@/components/logo-tile";
import { PageHeader } from "@/components/page-header";
import { FlagBadge, IssuesBadge, LogoStatusBadge, Pill } from "@/components/status-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LineupEntryView } from "@/lib/data/lineups";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";
import { BulkAddDialog, type AvailableChannel } from "./bulk-add-dialog";

const VIEW_KEY = "lineup-view";
const viewListeners = new Set<() => void>();

/** Grid/table choice, remembered per browser. */
function useViewPreference(): ["grid" | "table", (v: "grid" | "table") => void] {
  const view = useSyncExternalStore<"grid" | "table">(
    (cb) => {
      viewListeners.add(cb);
      return () => viewListeners.delete(cb);
    },
    () => {
      try {
        return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid";
      } catch {
        return "grid";
      }
    },
    () => "grid",
  );
  const set = (v: "grid" | "table") => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
    viewListeners.forEach((l) => l());
  };
  return [view, set];
}

type Filter = "all" | "problems" | "broken" | "missing" | "unchecked" | "flagged" | "incomplete" | "ok";

export function LineupBoard({
  cc,
  lineup,
  entries,
  warnings,
  available,
}: {
  cc: string;
  lineup: { id: number; name: string; slug: string; fileName: string };
  entries: LineupEntryView[];
  warnings: string[];
  available: AvailableChannel[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [view, changeView] = useViewPreference();
  const [clientFailed, setClientFailed] = useState<Set<number>>(new Set());

  const markFailed = useCallback((id: number, failed: boolean) => {
    setClientFailed((prev) => {
      if (prev.has(id) === failed) return prev;
      const next = new Set(prev);
      if (failed) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const is = useMemo(() => {
    const broken = (e: LineupEntryView) => e.logoStatus === "broken" || (e.logoStatus !== "missing" && clientFailed.has(e.channelId));
    const missing = (e: LineupEntryView) => e.logoStatus === "missing" || !e.logo;
    return {
      broken,
      missing,
      unchecked: (e: LineupEntryView) => e.logoStatus === "unchecked" && !clientFailed.has(e.channelId),
      flagged: (e: LineupEntryView) => e.logoFlagged,
      incomplete: (e: LineupEntryView) => e.issues.length > 0,
      ok: (e: LineupEntryView) => e.logoStatus === "ok" && !clientFailed.has(e.channelId) && !e.logoFlagged && !e.issues.length,
      problems: (e: LineupEntryView) => broken(e) || missing(e) || e.logoFlagged || e.issues.length > 0,
    };
  }, [clientFailed]);

  const counts = useMemo(
    () => ({
      broken: entries.filter(is.broken).length,
      missing: entries.filter(is.missing).length,
      flagged: entries.filter(is.flagged).length,
      incomplete: entries.filter(is.incomplete).length,
      unchecked: entries.filter(is.unchecked).length,
      ok: entries.filter(is.ok).length,
      problems: entries.filter(is.problems).length,
    }),
    [entries, is],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && !is[filter](e)) return false;
      if (needle && !`${e.dial} ${e.name} ${e.keywords.join(" ")} ${e.epgIds.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [entries, filter, q, is]);

  const chips: { key: Filter; label: string; n: number; tone: string }[] = [
    { key: "all", label: "All", n: entries.length, tone: "" },
    { key: "problems", label: "Any problem", n: counts.problems, tone: "text-red-700 dark:text-red-300" },
    { key: "broken", label: "Broken", n: counts.broken, tone: "text-red-700 dark:text-red-300" },
    { key: "missing", label: "Missing", n: counts.missing, tone: "text-red-700 dark:text-red-300" },
    { key: "flagged", label: "Looks wrong", n: counts.flagged, tone: "text-amber-700 dark:text-amber-300" },
    { key: "incomplete", label: "Incomplete", n: counts.incomplete, tone: "text-red-700 dark:text-red-300" },
    { key: "unchecked", label: "Unchecked", n: counts.unchecked, tone: "text-muted-foreground" },
    { key: "ok", label: "OK", n: counts.ok, tone: "text-emerald-700 dark:text-emerald-300" },
  ];

  return (
    <>
      <PageHeader
        title={lineup.name}
        description={
          <>
            {entries.length} channels · <code>{lineup.fileName}</code>
          </>
        }
        actions={
          <>
            <LineupNameDialog
              trigger={<Button variant="ghost"><PencilIcon /> Rename</Button>}
              title="Rename lineup"
              description="Changing the slug writes a new file on next export; the old file is left in place."
              countryCode={cc}
              initialName={lineup.name}
              initialSlug={lineup.slug}
              submitLabel="Save"
              onSubmit={(name, slug) => renameLineupAction(lineup.id, name, slug)}
              onDone={(l) => l && l.slug !== lineup.slug && router.replace(`/countries/${cc}/lineups/${l.slug}`)}
            />
            <CheckLogosButton scope={{ lineupId: lineup.id }} />
            <BulkAddDialog lineupId={lineup.id} existingDials={entries.map((e) => e.dial)} available={available} />
            <Link href={`/countries/${cc}/lineups/${lineup.slug}/export`} className={buttonVariants()}>
              <DownloadIcon /> Export
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            disabled={c.key !== "all" && c.n === 0}
            className={cn(
              "rounded-full border bg-background px-3 py-1 text-sm transition-colors disabled:opacity-40",
              filter === c.key ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/40",
            )}
          >
            <span className={cn("font-semibold tabular-nums", c.n > 0 && c.tone)}>{c.n}</span> {c.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Search dial, name, keyword…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <div className="flex rounded-lg border bg-background p-0.5">
            <Button size="icon-sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => changeView("grid")} title="Grid">
              <LayoutGridIcon />
            </Button>
            <Button size="icon-sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => changeView("table")} title="Table">
              <ListIcon />
            </Button>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4" /> Warnings
          </div>
          <ul className="list-disc pl-6">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          This lineup is empty. Use <strong>Add channels</strong> to pick channels from this country.
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {visible.map((e) => (
            <EntryCard key={e.entryId} cc={cc} entry={e} clientFailed={clientFailed.has(e.channelId)} onLoadError={markFailed} />
          ))}
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Dial</TableHead>
                <TableHead className="w-48">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>EPG ids</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((e) => (
                <TableRow key={e.entryId}>
                  <TableCell><DialInput entryId={e.entryId} dial={e.dial} /></TableCell>
                  <TableCell>
                    <LogoTile url={e.logo} size="sm" serverBroken={e.logoStatus === "broken"} onLoadError={(f) => markFailed(e.channelId, f)} />
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.categoryName ?? "—"}</TableCell>
                  <TableCell className="max-w-56 truncate font-mono text-xs" title={e.epgIds.join("\n")}>{e.epgIds.join(", ") || "—"}</TableCell>
                  <TableCell><EntryBadges entry={e} clientFailed={clientFailed.has(e.channelId)} /></TableCell>
                  <TableCell><EntryActions cc={cc} entry={e} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {entries.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No channels match this filter.</p>
      )}
    </>
  );
}

function EntryBadges({ entry: e, clientFailed }: { entry: LineupEntryView; clientFailed: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      <LogoStatusBadge status={e.logoStatus} error={e.logoError} checkedAt={e.logoCheckedAt} clientFailed={clientFailed} />
      <FlagBadge flagged={e.logoFlagged} note={e.logoFlagNote} />
      <IssuesBadge issues={e.issues} />
    </div>
  );
}

function EntryCard({
  cc,
  entry: e,
  clientFailed,
  onLoadError,
}: {
  cc: string;
  entry: LineupEntryView;
  clientFailed: boolean;
  onLoadError: (channelId: number, failed: boolean) => void;
}) {
  const bad = e.logoStatus === "broken" || e.logoStatus === "missing" || clientFailed || e.issues.length > 0;
  const handleError = useCallback((f: boolean) => onLoadError(e.channelId, f), [onLoadError, e.channelId]);
  return (
    <Card
      className={cn(
        "gap-2 px-3 py-3",
        bad && "border-red-400 bg-red-50/50 dark:bg-red-950/20",
        !bad && e.logoFlagged && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <DialInput entryId={e.entryId} dial={e.dial} />
        <EntryActions cc={cc} entry={e} />
      </div>
      <div className="flex justify-center py-1">
        <LogoTile url={e.logo} serverBroken={e.logoStatus === "broken"} onLoadError={handleError} />
      </div>
      <div className="min-w-0 space-y-1">
        <div className="truncate font-medium" title={e.name}>{e.name}</div>
        <ValuesRow label="KW" values={e.keywords} />
        <ValuesRow label="EPG" values={e.epgIds} />
      </div>
      <div className="flex flex-wrap gap-1">
        {e.categoryName ? <Pill kind="muted">{e.categoryName}</Pill> : <Pill kind="bad">Category missing</Pill>}
        <FlagBadge flagged={e.logoFlagged} note={e.logoFlagNote} />
      </div>
    </Card>
  );
}

/** First few values of a list, or a "missing" pill when it is empty. */
function ValuesRow({ label, values, max = 3 }: { label: string; values: string[]; max?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs" title={values.join("\n")}>
      <span className="w-8 shrink-0 text-muted-foreground">{label}</span>
      {values.length === 0 ? (
        <Pill kind="bad">missing</Pill>
      ) : (
        <>
          <span className="truncate font-mono">{values.slice(0, max).join(", ")}</span>
          {values.length > max && <span className="shrink-0 text-muted-foreground">+{values.length - max}</span>}
        </>
      )}
    </div>
  );
}

function DialInput({ entryId, dial }: { entryId: number; dial: number }) {
  // null = not editing, show the saved dial.
  const [draft, setDraft] = useState<string | null>(null);
  const { pending, exec } = useAction();
  const value = draft ?? String(dial);

  const commit = () => {
    if (draft === null || draft === String(dial)) return setDraft(null);
    exec(() => updateDialAction(entryId, Number(draft)), { onSuccess: () => setDraft(null), onError: () => setDraft(null) });
  };
  return (
    <Input
      aria-label="Dial"
      type="number"
      min={1}
      value={value}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-7 w-20 font-mono font-semibold tabular-nums"
    />
  );
}

function EntryActions({ cc, entry: e }: { cc: string; entry: LineupEntryView }) {
  const { pending, exec } = useAction();
  return (
    <div className="flex">
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        title={e.logoFlagged ? "Clear 'looks wrong' flag" : "Flag logo as looking wrong"}
        className={cn(e.logoFlagged && "text-amber-600")}
        onClick={() => exec(() => setLogoFlagAction(e.channelId, !e.logoFlagged, e.logoFlagNote))}
      >
        <FlagIcon />
      </Button>
      <Link href={`/countries/${cc}/channels/${e.channelId}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} title="Edit channel">
        <PencilIcon />
      </Link>
      <Button size="icon-sm" variant="ghost" disabled={pending} title="Remove from lineup" onClick={() => exec(() => removeEntryAction(e.entryId))}>
        <XIcon />
      </Button>
    </div>
  );
}
