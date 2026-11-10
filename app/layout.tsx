import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { TvIcon } from "lucide-react";
import { CountrySwitcher } from "@/components/country-switcher";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listCountries } from "@/lib/data/countries";
import { getDb } from "@/lib/db/client";
import "./globals.css";

// Everything reads live from SQLite; never prerender.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TV Lineups",
  description: "Manage TV broadcaster lineups per country and export them as JSON",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const countries = listCountries(getDb());
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted/30">
        <TooltipProvider>
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
              <Link href="/countries" className="flex items-center gap-2 font-semibold">
                <TvIcon className="size-5" /> TV Lineups
              </Link>
              <CountrySwitcher countries={countries} />
              <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/countries" className="hover:text-foreground">Countries</Link>
                <Link href="/import" className="hover:text-foreground">Import</Link>
                <Link href="/settings/categories" className="hover:text-foreground">Categories</Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
