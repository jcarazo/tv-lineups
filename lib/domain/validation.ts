import { z } from "zod";
import { CHANNELS_FORMAT, LINEUP_FORMAT } from "./constants";

/** Trim, drop empties and de-duplicate while keeping order. */
export function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function normalizeKeywords(values: string[]): string[] {
  return cleanList(values.map((v) => v.toUpperCase()));
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const httpUrl = z
  .string()
  .trim()
  .url("Logo must be a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "Logo must be an http(s) URL");

/** Rules for creating/editing a channel. All fields are mandatory. */
export const channelInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  logo: httpUrl,
  keywords: z
    .array(z.string())
    .transform(normalizeKeywords)
    .pipe(z.array(z.string()).min(1, "At least one keyword is required")),
  epgIds: z
    .array(z.string())
    .transform(cleanList)
    .pipe(z.array(z.string()).min(1, "At least one EPG id is required")),
  categoryId: z.coerce.number().int().positive("Category is required"),
});
export type ChannelInput = z.infer<typeof channelInputSchema>;

export const dialSchema = z.coerce
  .number()
  .int("Dial must be a whole number")
  .positive("Dial must be positive");

export const lineupNameSchema = z.string().trim().min(1, "Name is required");

/** What a channel needs to be exportable; used to flag "incomplete" ones. */
export function channelIssues(c: {
  name: string;
  logo: string | null;
  keywords: string[];
  epgIds: string[];
  categoryId: number | null;
}): string[] {
  const issues: string[] = [];
  if (!c.name.trim()) issues.push("Missing name");
  if (!c.logo?.trim()) issues.push("Missing logo");
  else if (!httpUrl.safeParse(c.logo).success) issues.push("Invalid logo URL");
  if (c.keywords.length === 0) issues.push("No keywords");
  if (c.epgIds.length === 0) issues.push("No EPG ids");
  if (c.categoryId == null) issues.push("No category");
  return issues;
}

/**
 * Lenient schema for files on import: lineup files (legacy data may be
 * incomplete) and channel-only files, where `name` and `dial` can be left out.
 */
export const importFileSchema = z.object({
  format: z.enum([LINEUP_FORMAT, CHANNELS_FORMAT]),
  version: z.number(),
  country: z.string().length(2),
  name: z.string().optional(),
  channels: z.array(
    z.object({
      dial: z.number().int().optional(),
      name: z.string(),
      logo: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      epg_ids: z.array(z.string()).optional(),
      category: z.string().optional(),
    }),
  ),
});
export type ImportFile = z.infer<typeof importFileSchema>;
export type ImportFileChannel = ImportFile["channels"][number];

/** Flatten zod errors into a field -> message map for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
