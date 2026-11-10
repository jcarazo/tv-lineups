"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { channelUsageAction, deleteChannelAction } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { useAction } from "@/lib/use-action";

type Usage = Awaited<ReturnType<typeof channelUsageAction>>;

/** Confirms with the list of affected lineups, then deletes the channel everywhere. */
export function DeleteChannelButton({
  id,
  name,
  onDeleted,
  iconOnly = true,
}: {
  id: number;
  name: string;
  onDeleted?: () => void;
  iconOnly?: boolean;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const { exec } = useAction();

  return (
    <ConfirmButton
      title={`Delete channel "${name}"?`}
      onOpen={() => channelUsageAction(id).then(setUsage)}
      description={
        usage === null ? (
          "Checking which lineups use it…"
        ) : usage.length === 0 ? (
          "It is not used by any lineup."
        ) : (
          <div className="space-y-2">
            <p>It will also be removed from {usage.length} lineup(s):</p>
            <ul className="list-disc pl-5">
              {usage.map((u) => (
                <li key={u.lineupId}>
                  {u.lineupName} <span className="text-muted-foreground">(dial {u.dial})</span>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      onConfirm={() => exec(() => deleteChannelAction(id), { onSuccess: onDeleted })}
      variant={iconOnly ? "ghost" : "destructive"}
      size={iconOnly ? "icon-sm" : "default"}
    >
      <Trash2Icon />
      {iconOnly ? <span className="sr-only">Delete</span> : "Delete channel"}
    </ConfirmButton>
  );
}
