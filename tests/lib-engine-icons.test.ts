import { describe, expect, it } from 'vitest';

import { getEngineConfig } from '@/lib/engine-icons';

describe('lib/engine-icons', () => {
  it('accepts canonical engine keys', () => {
    expect(getEngineConfig('claude-code')?.key).toBe('claude-code');
    expect(getEngineConfig('gemini-cli')?.key).toBe('gemini-cli');
  });

  it('defines distinct dispatch theme colors for engine icons', () => {
    expect(getEngineConfig('claude-code')?.color).toBe('#d97757');
    expect(getEngineConfig('claude-code')?.iconColor).toBe('#d97757');
    expect(getEngineConfig('codex')?.color).toBe('#ffffff');
    expect(getEngineConfig('codex')?.iconColor).toBe('#ffffff');
    expect(getEngineConfig('gemini-cli')?.color).toBe('#8ab4f8');
    expect(getEngineConfig('gemini-cli')?.iconColor).toBe(
      'linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #8ab4f8 100%)',
    );
  });

  it('rejects legacy aliases', () => {
    expect(getEngineConfig('claude')).toBeNull();
    expect(getEngineConfig('gemini')).toBeNull();
  });
});
