"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** A button that asks for confirmation. `onOpen` can load extra context (e.g. affected lineups). */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onOpen,
  children,
  variant = "destructive",
  size = "sm",
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onOpen?: () => void;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) onOpen?.();
      }}
    >
      <AlertDialogTrigger render={<Button variant={variant} size={size} />}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription render={<div />}>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              await onConfirm();
              setOpen(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
