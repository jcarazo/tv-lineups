import { Badge } from "@/components/ui/badge";
import type { LogoStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const tone = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  bad: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  warn: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  muted: "border-border bg-muted text-muted-foreground",
};

export function Pill({ kind, children, title }: { kind: keyof typeof tone; children: React.ReactNode; title?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", tone[kind])} title={title}>
      {children}
    </Badge>
  );
}

export function LogoStatusBadge({
  status,
  error,
  checkedAt,
  clientFailed,
}: {
  status: LogoStatus;
  error?: string | null;
  checkedAt?: Date | null;
  clientFailed?: boolean;
}) {
  const when = checkedAt ? `Checked ${checkedAt.toLocaleString()}` : "Never checked";
  if (status === "missing") return <Pill kind="bad" title="No logo URL">Logo missing</Pill>;
  if (status === "broken") return <Pill kind="bad" title={`${error ?? ""}\n${when}`}>Logo broken</Pill>;
  if (clientFailed) return <Pill kind="bad" title="The browser could not render this image">Won&apos;t render</Pill>;
  if (status === "ok") return <Pill kind="ok" title={when}>Logo OK</Pill>;
  return <Pill kind="muted" title={when}>Unchecked</Pill>;
}

export function IssuesBadge({ issues }: { issues: string[] }) {
  if (!issues.length) return null;
  return (
    <Pill kind="bad" title={issues.join("\n")}>
      Incomplete
    </Pill>
  );
}

export function FlagBadge({ flagged, note }: { flagged: boolean; note?: string | null }) {
  if (!flagged) return null;
  return (
    <Pill kind="warn" title={note ?? "Flagged as looking wrong"}>
      Looks wrong
    </Pill>
  );
}
