"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DeleteChannelButton } from "@/components/delete-channel-button";
import { LogoTile } from "@/components/logo-tile";
import { FlagBadge, IssuesBadge, LogoStatusBadge } from "@/components/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChannelView } from "@/lib/data/channels";

const FILTERS = {
  all: "All channels",
  logo: "Logo problems",
  incomplete: "Incomplete",
  flagged: "Flagged logos",
  unchecked: "Unchecked logos",
  unused: "Not in any lineup",
} as const;
type Filter = keyof typeof FILTERS;

// Accent/case-insensitive, numbers in natural order ("8" before "24H", "DAZN 2" before "DAZN 10").
const nameCollator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export function ChannelTable({ cc, channels, categories }: { cc: string; channels: ChannelView[]; categories: string[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [nameSort, setNameSort] = useState<"asc" | "desc">("asc");
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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = channels.filter((c) => {
      if (category && c.categoryName !== category) return false;
      if (needle) {
        const hay = [c.name, ...c.keywords, ...c.epgIds].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      switch (filter) {
        case "logo":
          return c.logoStatus === "broken" || c.logoStatus === "missing" || clientFailed.has(c.id);
        case "incomplete":
          return c.issues.length > 0;
        case "flagged":
          return c.logoFlagged;
        case "unchecked":
          return c.logoStatus === "unchecked";
        case "unused":
          return c.lineupCount === 0;
        default:
          return true;
      }
    });
    const dir = nameSort === "asc" ? 1 : -1;
    return filtered.sort((a, b) => dir * nameCollator.compare(a.name, b.name));
  }, [channels, q, category, filter, clientFailed, nameSort]);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input placeholder="Search name, keyword or EPG id" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          {Object.entries(FILTERS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} of {channels.length}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Logo</TableHead>
            <TableHead aria-sort={nameSort === "asc" ? "ascending" : "descending"}>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => setNameSort((d) => (d === "asc" ? "desc" : "asc"))}
                title={`Sort by name (${nameSort === "asc" ? "Z→A" : "A→Z"})`}
              >
                Name
                {nameSort === "asc" ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
              </button>
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Keywords</TableHead>
            <TableHead>EPG ids</TableHead>
            <TableHead>Lineups</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <LogoTile url={c.logo} size="sm" serverBroken={c.logoStatus === "broken"} onLoadError={(f) => markFailed(c.id, f)} />
              </TableCell>
              <TableCell className="font-medium">
                <Link href={`/countries/${cc}/channels/${c.id}`} className="hover:underline">{c.name}</Link>
              </TableCell>
              <TableCell>{c.categoryName ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="max-w-56 truncate font-mono text-xs" title={c.keywords.join(", ")}>
                {c.keywords.join(", ") || "—"}
              </TableCell>
              <TableCell className="max-w-56 truncate font-mono text-xs" title={c.epgIds.join("\n")}>
                {c.epgIds.length ? c.epgIds.join(", ") : "—"}
              </TableCell>
              <TableCell>{c.lineupCount}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <LogoStatusBadge status={c.logoStatus} error={c.logoError} checkedAt={c.logoCheckedAt} clientFailed={clientFailed.has(c.id)} />
                  <FlagBadge flagged={c.logoFlagged} note={c.logoFlagNote} />
                  <IssuesBadge issues={c.issues} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Link href={`/countries/${cc}/channels/${c.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                    <PencilIcon />
                    <span className="sr-only">Edit</span>
                  </Link>
                  <DeleteChannelButton id={c.id} name={c.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                No channels match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
