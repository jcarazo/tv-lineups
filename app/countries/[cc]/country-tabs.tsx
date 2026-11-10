"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CountryTabs({ cc }: { cc: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/countries/${cc}/lineups`, label: "Lineups" },
    { href: `/countries/${cc}/channels`, label: "Channels" },
  ];
  return (
    <nav className="ml-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1 text-muted-foreground transition-colors hover:text-foreground",
            pathname.startsWith(t.href) && "bg-background font-medium text-foreground shadow-sm",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
