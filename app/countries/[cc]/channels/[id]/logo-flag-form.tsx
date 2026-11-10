"use client";

import { useState } from "react";
import { setLogoFlagAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";

/** Lets the user mark a logo that loads but is wrong (old branding, wrong channel, ugly). */
export function LogoFlagForm({ id, flagged, note }: { id: number; flagged: boolean; note: string | null }) {
  const [text, setText] = useState(note ?? "");
  const { pending, exec } = useAction();

  if (flagged) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Flagged as looking wrong{note ? <>: <em>{note}</em></> : "."}
        </p>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => exec(() => setLogoFlagAction(id, false, null))}>
          Clear flag
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => setLogoFlagAction(id, true, text));
      }}
    >
      <Input placeholder="What's wrong? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" variant="outline" type="submit" disabled={pending}>
        Flag &ldquo;looks wrong&rdquo;
      </Button>
    </form>
  );
}
