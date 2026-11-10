"use client";

import { diffLines } from "diff";
import { CheckCircle2Icon, Loader2Icon, OctagonXIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { recheckAndPreviewAction, writeExportAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExportPreview } from "@/lib/data/exporter";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";

export function ExportPanel({ initial }: { initial: ExportPreview }) {
  const [preview, setPreview] = useState(initial);
  const [checking, startCheck] = useTransition();
  const { pending, exec } = useAction();

  // Re-check every logo in the lineup before allowing an export.
  useEffect(() => {
    startCheck(async () => {
      const r = await recheckAndPreviewAction(initial.lineupId);
      if (r.ok && r.data) setPreview(r.data);
    });
  }, [initial.lineupId]);

  const hunks = useMemo(() => diffLines(preview.onDisk ?? "", preview.content), [preview.onDisk, preview.content]);
  const added = hunks.filter((h) => h.added).reduce((n, h) => n + (h.count ?? 0), 0);
  const removed = hunks.filter((h) => h.removed).reduce((n, h) => n + (h.count ?? 0), 0);
  const blocked = preview.blockers.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex-1 text-sm">
            <div>
              Target: <code className="rounded bg-muted px-1">{preview.filePath}</code>
            </div>
            <div className="mt-1 text-muted-foreground">
              {preview.onDisk === null
                ? "New file (does not exist yet)."
                : preview.unchanged
                  ? "File on disk is identical."
                  : `Changes vs. file on disk: +${added} / −${removed} lines.`}
            </div>
          </div>
          {checking && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Re-checking logos…
            </span>
          )}
          <Button
            size="lg"
            disabled={blocked || pending || checking || preview.unchanged}
            onClick={() => exec(() => writeExportAction(preview.lineupId), { onSuccess: (d) => d && setPreview(d) })}
          >
            <SaveIcon /> {preview.unchanged ? "Up to date" : pending ? "Writing…" : "Write file"}
          </Button>
        </CardContent>
      </Card>

      {blocked && (
        <IssueList
          tone="bad"
          title={`Export blocked: ${preview.blockers.length} issue(s)`}
          items={preview.blockers}
          icon={<OctagonXIcon className="size-4" />}
        />
      )}
      {preview.warnings.length > 0 && (
        <IssueList
          tone="warn"
          title={`${preview.warnings.length} warning(s): export is allowed`}
          items={preview.warnings}
          icon={<TriangleAlertIcon className="size-4" />}
        />
      )}
      {!blocked && preview.warnings.length === 0 && !checking && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2Icon className="size-4" /> All channels complete and all logos OK.
        </div>
      )}

      <Tabs defaultValue={initial.onDisk === null ? "json" : "diff"}>
        <TabsList>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="json">Generated JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="diff">
          <Card className="py-0">
            <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-5">
              {preview.unchanged ? (
                <span className="text-muted-foreground">No differences.</span>
              ) : (
                hunks.map((h, i) => <DiffHunk key={i} value={h.value} added={h.added} removed={h.removed} />)
              )}
            </pre>
          </Card>
        </TabsContent>
        <TabsContent value="json">
          <Card className="py-0">
            <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-5">{preview.content}</pre>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shows changed lines plus 3 lines of context around them. */
function DiffHunk({ value, added, removed }: { value: string; added?: boolean; removed?: boolean }) {
  const lines = value.replace(/\n$/, "").split("\n");
  if (added || removed) {
    return (
      <>
        {lines.map((l, i) => (
          <div key={i} className={cn(added ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200")}>
            {added ? "+ " : "- "}
            {l}
          </div>
        ))}
      </>
    );
  }
  const ctx = 3;
  if (lines.length <= ctx * 2 + 1) return <>{lines.map((l, i) => <div key={i} className="text-muted-foreground">{"  "}{l}</div>)}</>;
  return (
    <>
      {lines.slice(0, ctx).map((l, i) => <div key={`a${i}`} className="text-muted-foreground">{"  "}{l}</div>)}
      <div className="my-1 text-center text-muted-foreground/60">⋯ {lines.length - ctx * 2} unchanged lines ⋯</div>
      {lines.slice(-ctx).map((l, i) => <div key={`b${i}`} className="text-muted-foreground">{"  "}{l}</div>)}
    </>
  );
}

function IssueList({ tone, title, items, icon }: { tone: "bad" | "warn"; title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <Card className={cn(tone === "bad" ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30")}>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2 text-sm", tone === "bad" ? "text-red-800 dark:text-red-200" : "text-amber-900 dark:text-amber-200")}>
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
