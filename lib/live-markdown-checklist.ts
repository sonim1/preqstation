export type LiveChecklistMarker = {
  checked: boolean;
  content: string;
  markerLength: 5 | 6;
};

export const LIVE_CHECKLIST_MARKER_ONLY_LENGTH = 5;
export const LIVE_CHECKLIST_MARKER_LENGTH = 6;

export function parseLiveChecklistMarker(line: string): LiveChecklistMarker | null {
  const match = /^- \[([ xX])\](?: (.*))?$/.exec(line);
  if (!match) return null;

  const hasTrailingSpace = match[2] !== undefined;

  return {
    checked: match[1].toLowerCase() === 'x',
    content: match[2] ?? '',
    markerLength: hasTrailingSpace
      ? LIVE_CHECKLIST_MARKER_LENGTH
      : LIVE_CHECKLIST_MARKER_ONLY_LENGTH,
  };
}

export function isCursorInsideLiveChecklistMarker(cursorInLine: number): boolean {
  return cursorInLine >= 0 && cursorInLine <= LIVE_CHECKLIST_MARKER_LENGTH;
}
