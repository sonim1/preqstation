import { describe, expect, it } from 'vitest';

import {
  isCursorInsideLiveChecklistMarker,
  parseLiveChecklistMarker,
} from '@/lib/live-markdown-checklist';

describe('lib/live-markdown-checklist', () => {
  it('parses complete unchecked and checked checklist markers', () => {
    expect(parseLiveChecklistMarker('- [ ] ')).toEqual({
      checked: false,
      content: '',
      markerLength: 6,
    });
    expect(parseLiveChecklistMarker('- [x] done')).toEqual({
      checked: true,
      content: 'done',
      markerLength: 6,
    });
    expect(parseLiveChecklistMarker('- [X] done')).toEqual({
      checked: true,
      content: 'done',
      markerLength: 6,
    });
  });

  it('rejects incomplete or malformed checklist markers', () => {
    expect(parseLiveChecklistMarker('- [ ]text')).toBeNull();
    expect(parseLiveChecklistMarker('- [')).toBeNull();
    expect(parseLiveChecklistMarker('-[ ] ')).toBeNull();
  });

  it('treats every marker character and the final marker space as source editing range', () => {
    for (let cursor = 0; cursor <= 5; cursor += 1) {
      expect(isCursorInsideLiveChecklistMarker(cursor)).toBe(true);
    }

    expect(isCursorInsideLiveChecklistMarker(6)).toBe(false);
  });
});
