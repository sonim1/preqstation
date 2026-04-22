export function parseChecklistCounts(
  note: string | null | undefined,
): { done: number; total: number } | null {
  if (!note) return null;
  const matches = note.match(/^\s*- \[([ xX])\]/gm);
  if (!matches || matches.length === 0) return null;
  const total = matches.length;
  const done = matches.filter((m) => /\[([xX])\]/.test(m)).length;
  return { done, total };
}
