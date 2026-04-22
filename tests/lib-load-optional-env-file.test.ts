import { describe, expect, it, vi } from 'vitest';

import { loadOptionalEnvFile } from '@/lib/load-optional-env-file';

describe('loadOptionalEnvFile', () => {
  it('does not load a file when it is missing', () => {
    const exists = vi.fn().mockReturnValue(false);
    const load = vi.fn();

    loadOptionalEnvFile('.env.local', { exists, load });

    expect(exists).toHaveBeenCalledWith('.env.local');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads a file when it exists', () => {
    const exists = vi.fn().mockReturnValue(true);
    const load = vi.fn();

    loadOptionalEnvFile('.env.local', { exists, load });

    expect(load).toHaveBeenCalledWith('.env.local');
  });
});
