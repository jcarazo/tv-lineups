"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Tag-style list input. Enter or comma adds; pasting a list splits on commas/new lines. */
export function ChipInput({
  value,
  onChange,
  placeholder,
  transform = (v) => v,
  invalid,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  transform?: (v: string) => string;
  invalid?: boolean;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw.split(/[,\n]/).map((p) => transform(p.trim())).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
          {v}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none"
        value={draft}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
    </div>
  );
}
