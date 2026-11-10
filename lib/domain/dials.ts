/** Next `count` free dials after the current highest one (gaps are left for the user). */
export function suggestDials(existingDials: number[], count: number): number[] {
  const used = new Set(existingDials);
  const out: number[] = [];
  let d = existingDials.length ? Math.max(...existingDials) + 1 : 1;
  while (out.length < count) {
    if (!used.has(d)) out.push(d);
    d++;
  }
  return out;
}
