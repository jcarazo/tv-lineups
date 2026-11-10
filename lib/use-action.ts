"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/data/errors";

/** Runs a server action in a transition and toasts its outcome. */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function exec<T>(
    action: () => Promise<ActionResult<T>>,
    opts: { onSuccess?: (data: T | undefined) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void; quiet?: boolean } = {},
  ) {
    startTransition(async () => {
      const r = await action();
      if (r.ok) {
        if (r.message && !opts.quiet) toast.success(r.message);
        opts.onSuccess?.(r.data);
      } else {
        toast.error(r.error);
        opts.onError?.(r);
      }
    });
  }

  return { pending, exec };
}
