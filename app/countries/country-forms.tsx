"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCountryAction, deleteCountryAction } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";

export function AddCountry({ options }: { options: { code: string; name: string }[] }) {
  const [code, setCode] = useState("");
  const { pending, exec } = useAction();
  const router = useRouter();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code)
          exec(() => createCountryAction(code), {
            onSuccess: () => router.push(`/countries/${code.toLowerCase()}`),
          });
      }}
    >
      <select
        aria-label="ISO country"
        className="h-8 w-64 rounded-lg border bg-background px-2 text-sm"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      >
        <option value="">Choose a country…</option>
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.code})
          </option>
        ))}
      </select>
      <Button type="submit" disabled={!code || pending}>
        Add country
      </Button>
    </form>
  );
}

export function DeleteCountry(props: { code: string; name: string; channelCount: number; lineupCount: number }) {
  const { exec } = useAction();
  return (
    <ConfirmButton
      title={`Delete ${props.name}?`}
      description={`This permanently deletes its ${props.channelCount} channels and ${props.lineupCount} lineups from the app. Exported files are not touched.`}
      onConfirm={() => exec(() => deleteCountryAction(props.code))}
      variant="ghost"
      size="icon-sm"
    >
      <Trash2Icon />
      <span className="sr-only">Delete</span>
    </ConfirmButton>
  );
}
