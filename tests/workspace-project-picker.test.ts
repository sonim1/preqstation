// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  pushRecentProjectKey,
  readRecentProjectKeys,
  RECENT_PROJECTS_CHANGED_EVENT,
  RECENT_PROJECTS_STORAGE,
} from '@/lib/workspace-project-picker';

afterEach(() => {
  window.localStorage.removeItem(RECENT_PROJECTS_STORAGE);
});

describe('lib/workspace-project-picker', () => {
  it('keeps the five most recent project keys', () => {
    const listener = vi.fn();
    window.addEventListener(RECENT_PROJECTS_CHANGED_EVENT, listener);

    try {
      ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA'].forEach(pushRecentProjectKey);

      expect(readRecentProjectKeys()).toEqual(['ZETA', 'EPSILON', 'DELTA', 'GAMMA', 'BETA']);
      expect(listener).toHaveBeenCalledTimes(6);
    } finally {
      window.removeEventListener(RECENT_PROJECTS_CHANGED_EVENT, listener);
    }
  });
});
