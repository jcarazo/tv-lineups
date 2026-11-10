"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveChannelAction, type ChannelFormValues } from "@/app/actions";
import { ChipInput } from "@/components/chip-input";
import { LogoTile } from "@/components/logo-tile";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/lib/use-action";

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label} <span className="text-destructive">*</span>
      </Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ChannelForm({
  cc,
  channelId,
  initial,
  categories,
}: {
  cc: string;
  channelId: number | null;
  initial: ChannelFormValues;
  categories: { id: number; name: string }[];
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState(initial.logo);
  const { pending, exec } = useAction();
  const router = useRouter();
  const set = <K extends keyof ChannelFormValues>(k: K, v: ChannelFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => saveChannelAction(cc.toUpperCase(), channelId, values), {
          onSuccess: () => {
            setErrors({});
            // replace, so the browser back button doesn't land on an empty "new" form.
            if (channelId == null) router.replace(`/countries/${cc}/channels`);
          },
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Card>
        <CardContent className="grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="space-y-5">
            <Field label="Name" htmlFor="name" error={errors.name}>
              <Input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Logo URL" htmlFor="logo" error={errors.logo} hint="External image URL. It is checked when you save.">
              <Input
                id="logo"
                value={values.logo}
                onChange={(e) => set("logo", e.target.value)}
                onBlur={() => setPreviewUrl(values.logo.trim())}
                placeholder="https://…/logo.svg"
                aria-invalid={!!errors.logo}
              />
            </Field>
            <Field label="Keywords" htmlFor="keywords" error={errors.keywords} hint="Enter or comma to add. Stored in UPPERCASE.">
              <ChipInput
                id="keywords"
                value={values.keywords}
                onChange={(v) => set("keywords", v)}
                transform={(v) => v.toUpperCase()}
                placeholder="LA 1, TVE1…"
                invalid={!!errors.keywords}
              />
            </Field>
            <Field label="EPG ids" htmlFor="epgIds" error={errors.epgIds} hint="Enter or comma to add. Case is kept.">
              <ChipInput id="epgIds" value={values.epgIds} onChange={(v) => set("epgIds", v)} placeholder="La1.es…" invalid={!!errors.epgIds} />
            </Field>
            <Field label="Category" htmlFor="category" error={errors.categoryId}>
              <select
                id="category"
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm aria-invalid:border-destructive"
                value={values.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                aria-invalid={!!errors.categoryId}
              >
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <LogoTile url={previewUrl || null} size="lg" />
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : channelId == null ? "Create channel" : "Save changes"}</Button>
        <Link href={`/countries/${cc}/channels`} className={buttonVariants({ variant: "ghost" })}>
          Back to channels
        </Link>
      </div>
    </form>
  );
}
