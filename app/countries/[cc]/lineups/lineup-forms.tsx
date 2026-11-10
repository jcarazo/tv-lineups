"use client";

import { CopyIcon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createLineupAction,
  deleteLineupAction,
  duplicateLineupAction,
  renameLineupAction,
  writeCountryExportsAction,
} from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { LineupNameDialog } from "@/components/lineup-name-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";

type LineupRow = { id: number; name: string; slug: string; entryCount: number };

export function CreateLineupButton({ cc }: { cc: string }) {
  const router = useRouter();
  return (
    <LineupNameDialog
      trigger={<Button><PlusIcon /> New lineup</Button>}
      title="New lineup"
      countryCode={cc}
      submitLabel="Create"
      onSubmit={(name, slug) => createLineupAction(cc.toUpperCase(), name, slug)}
      onDone={(l) => l && router.push(`/countries/${cc}/lineups/${l.slug}`)}
    />
  );
}

export function LineupActions({ cc, lineup }: { cc: string; lineup: LineupRow }) {
  const router = useRouter();
  const { exec } = useAction();
  return (
    <div className="flex items-center gap-1">
      <Link href={`/countries/${cc}/lineups/${lineup.slug}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <DownloadIcon /> Export
      </Link>
      <LineupNameDialog
        trigger={<Button variant="ghost" size="icon-sm" title="Rename"><PencilIcon /></Button>}
        title="Rename lineup"
        description="Changing the slug writes a new file on next export; the old file is left in place."
        countryCode={cc}
        initialName={lineup.name}
        initialSlug={lineup.slug}
        submitLabel="Save"
        onSubmit={(name, slug) => renameLineupAction(lineup.id, name, slug)}
      />
      <LineupNameDialog
        trigger={<Button variant="ghost" size="icon-sm" title="Duplicate"><CopyIcon /></Button>}
        title={`Duplicate "${lineup.name}"`}
        description={`Copies all ${lineup.entryCount} channels with their dials into a new lineup of this country.`}
        countryCode={cc}
        initialName={`${lineup.name} copy`}
        submitLabel="Duplicate"
        onSubmit={(name, slug) => duplicateLineupAction(lineup.id, name, slug)}
        onDone={(l) => l && router.push(`/countries/${cc}/lineups/${l.slug}`)}
      />
      <ConfirmButton
        title={`Delete lineup "${lineup.name}"?`}
        description="Channels stay in the country. Exported files are not deleted."
        onConfirm={() => exec(() => deleteLineupAction(lineup.id))}
        variant="ghost"
        size="icon-sm"
      >
        <Trash2Icon />
        <span className="sr-only">Delete</span>
      </ConfirmButton>
    </div>
  );
}

export function ExportAllButton({ countryCode }: { countryCode: string }) {
  const { pending, exec } = useAction();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        exec(() => writeCountryExportsAction(countryCode), {
          onSuccess: (d) => {
            if (!d) return;
            if (d.written.length) toast.success(`Written: ${d.written.join(", ")}`);
            if (d.blocked.length) toast.error(`Blocked (fix incomplete channels): ${d.blocked.join(", ")}`);
          },
        })
      }
    >
      <DownloadIcon /> {pending ? "Exporting…" : "Export all"}
    </Button>
  );
}
