"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/data/errors";
import { lineupFileName } from "@/lib/domain/export";
import { slugify } from "@/lib/domain/validation";
import { useAction } from "@/lib/use-action";

/** Name + file slug dialog used for create, rename and duplicate. */
export function LineupNameDialog<T>({
  trigger,
  title,
  description,
  countryCode,
  initialName = "",
  initialSlug = "",
  submitLabel,
  onSubmit,
  onDone,
}: {
  trigger: React.ReactElement;
  title: string;
  description?: string;
  countryCode: string;
  initialName?: string;
  initialSlug?: string;
  submitLabel: string;
  onSubmit: (name: string, slug: string) => Promise<ActionResult<T>>;
  onDone?: (data: T | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const { pending, exec } = useAction();
  const effectiveSlug = slugify(slug || name);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(initialName);
          setSlug(initialSlug);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => onSubmit(name, slug), {
              onSuccess: (d) => {
                setOpen(false);
                onDone?.(d);
              },
              onError: (r) => setError(r.error),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="lineup-name">Lineup name</Label>
            <Input id="lineup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Movistar Spain" autoFocus />
            <p className="text-xs text-muted-foreground">Written to the JSON <code>name</code> field.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lineup-slug">File slug</Label>
            <Input id="lineup-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name) || "defaults to the name"} />
            <p className="text-xs text-muted-foreground">
              File: <code>{effectiveSlug ? lineupFileName(countryCode, effectiveSlug) : "—"}</code>
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
