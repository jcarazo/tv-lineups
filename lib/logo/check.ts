export interface LogoCheckResult {
  ok: boolean;
  httpStatus: number | null;
  contentType: string | null;
  error: string | null;
}

const MAX_BYTES = 5 * 1024 * 1024;

function sniffRaster(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 12))) return "avif";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ico";
  return null;
}

/** True when the text is an SVG document: an <svg> root after optional prolog/comments. */
export function looksLikeSvg(text: string): boolean {
  const body = text
    .replace(/^﻿/, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .trimStart();
  return /^<svg[\s>]/i.test(body) && /<\/svg>\s*$|\/>\s*$/i.test(body.trimEnd());
}

/**
 * Downloads a logo and decides whether it is a usable image: 2xx status, an
 * image content-type, and a body that really is an SVG or a known raster.
 */
export async function checkLogoUrl(
  url: string,
  timeoutMs = 10_000,
): Promise<LogoCheckResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "tv-lineups-logo-checker/1.0", accept: "image/*" },
    });
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    const reason =
      e.name === "TimeoutError" ? `Timed out after ${timeoutMs / 1000}s` : e.cause?.code ?? e.message;
    return { ok: false, httpStatus: null, contentType: null, error: reason };
  }

  const contentType = res.headers.get("content-type");
  const base = { httpStatus: res.status, contentType };
  if (!res.ok) {
    await res.body?.cancel();
    return { ...base, ok: false, error: `HTTP ${res.status}` };
  }
  if (!contentType?.toLowerCase().startsWith("image/")) {
    await res.body?.cancel();
    return { ...base, ok: false, error: `Not an image (content-type: ${contentType ?? "none"})` };
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) return { ...base, ok: false, error: "Empty response" };
  if (buf.byteLength > MAX_BYTES) return { ...base, ok: false, error: "Image larger than 5 MB" };

  if (contentType.toLowerCase().includes("svg")) {
    const text = new TextDecoder().decode(buf);
    return looksLikeSvg(text)
      ? { ...base, ok: true, error: null }
      : { ...base, ok: false, error: "Body is not a valid SVG" };
  }
  return sniffRaster(buf)
    ? { ...base, ok: true, error: null }
    : { ...base, ok: false, error: "Body is not a recognised image format" };
}
