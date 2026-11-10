"use client";

import { ImageOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders the logo on a light and a dark tile (many logos are white or black
 * only). Reports load failures so lists can count logos that don't render.
 */
export function LogoTile({
  url,
  serverBroken = false,
  size = "md",
  onLoadError,
}: {
  url: string | null;
  serverBroken?: boolean;
  size?: "sm" | "md" | "lg";
  onLoadError?: (failed: boolean) => void;
}) {
  // Remember which URL failed so editing the URL clears the error without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !!url && failedUrl === url;
  useEffect(() => onLoadError?.(failed), [failed, onLoadError]);

  const box = { sm: "h-9 w-14", md: "h-12 w-20", lg: "h-20 w-32" }[size];
  const bad = !url || failed || serverBroken;

  if (!url || failed) {
    return (
      <div
        className={cn(
          box,
          "flex flex-col items-center justify-center rounded-md border-2 border-dashed border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40",
        )}
        title={url ? `Image failed to load: ${url}` : "No logo URL"}
      >
        <ImageOffIcon className="size-4" />
        <span className="text-[10px] font-medium leading-tight">{url ? "Won't load" : "No logo"}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1 rounded-md", bad && "ring-2 ring-red-500 ring-offset-1")} title={url}>
      {(["bg-white", "bg-neutral-900"] as const).map((bg) => (
        <div key={bg} className={cn(box, bg, "flex items-center justify-center rounded-md border p-1")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts */}
          <img
            src={url}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onError={() => setFailedUrl(url)}
            // A server-rendered <img> can fail before hydration attaches onError.
            ref={(el) => {
              if (el?.complete && el.naturalWidth === 0) setFailedUrl(url);
            }}
          />
        </div>
      ))}
    </div>
  );
}
