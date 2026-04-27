import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  QA_DISPATCH_PREFERENCE_STORAGE,
  readQaDispatchPreference,
  readTaskDispatchPreference,
  TASK_DISPATCH_PREFERENCES_STORAGE,
  writeQaDispatchPreference,
  writeTaskDispatchPreference,
} from '@/lib/dispatch-preferences';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const originalWindow = globalThis.window;
const legacyClaudeDispatchAction = ['send', 'claude-code'].join('-');

function installWindow(localStorage: Storage) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });
}

describe('lib/dispatch-preferences', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    localStorage = new MemoryStorage();
    installWindow(localStorage);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('round-trips task dispatch preferences by board status', () => {
    writeTaskDispatchPreference('ready', {
      engine: 'claude-code',
      action: 'send-telegram',
      objective: 'review',
    });
    writeTaskDispatchPreference('inbox', {
      engine: 'codex',
      action: 'send-hermes-telegram',
      objective: 'ask',
    });

    expect(readTaskDispatchPreference('ready')).toEqual({
      engine: 'claude-code',
      action: 'send-telegram',
      objective: 'review',
    });
    expect(readTaskDispatchPreference('inbox')).toEqual({
      engine: 'codex',
      action: 'send-hermes-telegram',
      objective: 'ask',
    });
    expect(localStorage.getItem(TASK_DISPATCH_PREFERENCES_STORAGE)).toContain('"ready"');
    expect(localStorage.getItem(TASK_DISPATCH_PREFERENCES_STORAGE)).toContain('"inbox"');
  });

  it('returns null for task preferences when storage JSON is malformed', () => {
    localStorage.setItem(TASK_DISPATCH_PREFERENCES_STORAGE, '{');

    expect(readTaskDispatchPreference('todo')).toBeNull();
  });

  it('returns null for task preferences when the stored payload is invalid', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'not-real',
          action: 'launch-rocket',
          objective: 'ask',
        },
      }),
    );

    expect(readTaskDispatchPreference('todo')).toBeNull();
  });

  it('returns null for legacy Claude task dispatch actions', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'codex',
          action: legacyClaudeDispatchAction,
          objective: 'implement',
        },
      }),
    );

    expect(readTaskDispatchPreference('todo')).toBeNull();
  });

  it('defaults missing objective to default for older stored preferences', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'codex',
          action: 'send-telegram',
        },
      }),
    );

    expect(readTaskDispatchPreference('todo')).toEqual({
      engine: 'codex',
      action: 'send-telegram',
      objective: 'default',
    });
  });

  it('round-trips the QA engine preference independently', () => {
    writeQaDispatchPreference('gemini-cli');

    expect(readQaDispatchPreference()).toBe('gemini-cli');
    expect(localStorage.getItem(QA_DISPATCH_PREFERENCE_STORAGE)).toBe('"gemini-cli"');
  });

  it('returns null during SSR when window is unavailable', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    expect(readTaskDispatchPreference('done')).toBeNull();
    expect(readQaDispatchPreference()).toBeNull();
  });
});
