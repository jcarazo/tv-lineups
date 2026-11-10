"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { addEntriesAction } from "@/app/actions";
import { LogoTile } from "@/components/logo-tile";
import { IssuesBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { suggestDials } from "@/lib/domain/dials";
import { useAction } from "@/lib/use-action";

export type AvailableChannel = { id: number; name: string; logo: string | null; categoryName: string | null; issues: string[] };

/** Pick several country channels; dials are pre-filled with the next free numbers and can be adjusted. */
export function BulkAddDialog({
  lineupId,
  existingDials,
  available,
}: {
  lineupId: number;
  existingDials: number[];
  available: AvailableChannel[];
}) {
  const { cc } = useParams<{ cc: string }>();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [dials, setDials] = useState<Record<number, string>>({});
  const { pending, exec } = useAction();

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? available.filter((c) => c.name.toLowerCase().includes(n)) : available;
  }, [available, q]);

  function toggle(id: number, on: boolean) {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    setSelected(next);
    // Re-suggest dials for selected rows the user hasn't edited, in selection order.
    const taken = [...existingDials, ...next.filter((x) => dials[x] && x !== id).map((x) => Number(dials[x]))];
    if (on && !dials[id]) setDials((d) => ({ ...d, [id]: String(suggestDials(taken, 1)[0]) }));
    if (!on)
      setDials((d) => {
        const rest = { ...d };
        delete rest[id];
        return rest;
      });
  }

  const items = selected.map((id) => ({ channelId: id, dial: Number(dials[id]) }));
  const dialValues = items.map((i) => i.dial);
  const duplicate = dialValues.some((d, i) => dialValues.indexOf(d) !== i || existingDials.includes(d));
  const invalid = dialValues.some((d) => !Number.isInteger(d) || d < 1);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSelected([]);
          setDials({});
          setQ("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon /> Add channels
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add channels</DialogTitle>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every channel of this country is already in the lineup.{" "}
            <Link className="underline" href={`/countries/${cc}/channels/new`}>Create a new channel</Link>.
          </p>
        ) : (
          <>
            <Input placeholder="Filter channels" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <div className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
              {filtered.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <Checkbox checked={on} onCheckedChange={(v) => toggle(c.id, !!v)} />
                    <LogoTile url={c.logo} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.categoryName ?? "No category"}</div>
                    </div>
                    <IssuesBadge issues={c.issues} />
                    {on && (
                      <Input
                        aria-label={`Dial for ${c.name}`}
                        type="number"
                        min={1}
                        className="h-7 w-20 font-mono"
                        value={dials[c.id] ?? ""}
                        onClick={(e) => e.preventDefault()}
                        onChange={(e) => setDials((d) => ({ ...d, [c.id]: e.target.value }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {duplicate && <p className="text-sm text-destructive">Each dial must be unique and not already used in this lineup.</p>}
          </>
        )}
        <DialogFooter>
          <Button
            disabled={pending || selected.length === 0 || duplicate || invalid}
            onClick={() => exec(() => addEntriesAction(lineupId, items), { onSuccess: () => setOpen(false) })}
          >
            Add {selected.length || ""} channel{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
