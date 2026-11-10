"use client";

import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { checkLogosAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";

export function CheckLogosButton({
  scope,
  label = "Check logos",
  size = "default",
  variant = "outline",
}: {
  scope: Parameters<typeof checkLogosAction>[0];
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending, exec } = useAction();
  return (
    <Button
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => exec(() => checkLogosAction(scope), { onSuccess: (d) => d && toast.info(d.summary) })}
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {pending ? "Checking…" : label}
    </Button>
  );
}
