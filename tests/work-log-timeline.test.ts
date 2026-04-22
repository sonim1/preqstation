import { describe, expect, it } from 'vitest';

import { resolveWorkLogEngine } from '@/app/components/work-log-timeline';
import { getEngineConfig } from '@/lib/engine-icons';

describe('resolveWorkLogEngine', () => {
  it('prefers work log engine when present', () => {
    expect(resolveWorkLogEngine({ engine: 'gemini-cli', todo: { engine: 'codex' } })).toBe(
      'gemini-cli',
    );
  });

  it('falls back to todo engine when work log engine is empty', () => {
    expect(resolveWorkLogEngine({ engine: '', todo: { engine: 'codex' } })).toBe('codex');
  });

  it('falls back to task engine when work log engine is empty', () => {
    expect(resolveWorkLogEngine({ engine: '', task: { engine: 'codex' } })).toBe('codex');
  });

  it('falls back to todo engine when work log engine is unknown', () => {
    expect(resolveWorkLogEngine({ engine: 'openclaw', todo: { engine: 'codex' } })).toBe('codex');
  });

  it('keeps at least one engine badge in PROJ-118 fallback scenario', () => {
    const logs = [
      { engine: 'openclaw', todo: { engine: 'codex' } },
      { engine: null, todo: { engine: null } },
    ];
    const engineBadgeCount = logs.filter((log) =>
      getEngineConfig(resolveWorkLogEngine(log)),
    ).length;
    expect(engineBadgeCount).toBeGreaterThanOrEqual(1);
  });

  it('falls back to canonical todo engine when work log engine is unknown', () => {
    expect(resolveWorkLogEngine({ engine: 'openclaw', todo: { engine: 'claude-code' } })).toBe(
      'claude-code',
    );
  });

  it('returns null when neither engine is available', () => {
    expect(resolveWorkLogEngine({ engine: '   ', todo: { engine: null } })).toBeNull();
  });
});
