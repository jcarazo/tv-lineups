"use client";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/lib/use-action";

export function AddCategory() {
  const [name, setName] = useState("");
  const { pending, exec } = useAction();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => createCategoryAction(name), { onSuccess: () => setName("") });
      }}
    >
      <Input placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
      <Button type="submit" disabled={!name.trim() || pending}>
        Add
      </Button>
    </form>
  );
}

export function CategoryRow({
  category,
  first,
  last,
}: {
  category: { id: number; name: string; usage: number };
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const { pending, exec } = useAction();

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => renameCategoryAction(category.id, name), { onSuccess: () => setEditing(false) });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
          <Button type="submit" size="sm" disabled={pending}>Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setName(category.name); setEditing(false); }}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 font-medium">{category.name}</span>
          <span className="text-sm text-muted-foreground">{category.usage} channels</span>
          <Button size="icon-sm" variant="ghost" disabled={first || pending} onClick={() => exec(() => moveCategoryAction(category.id, "up"))}>
            <ArrowUpIcon /><span className="sr-only">Move up</span>
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={last || pending} onClick={() => exec(() => moveCategoryAction(category.id, "down"))}>
            <ArrowDownIcon /><span className="sr-only">Move down</span>
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}>
            <PencilIcon /><span className="sr-only">Rename</span>
          </Button>
          {category.usage === 0 ? (
            <ConfirmButton
              title={`Delete "${category.name}"?`}
              onConfirm={() => exec(() => deleteCategoryAction(category.id))}
              variant="ghost"
              size="icon-sm"
            >
              <Trash2Icon /><span className="sr-only">Delete</span>
            </ConfirmButton>
          ) : (
            <Button size="icon-sm" variant="ghost" disabled title="In use by channels">
              <Trash2Icon />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
