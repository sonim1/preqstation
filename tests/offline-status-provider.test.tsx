import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveOfflineStatus } from '@/app/components/offline-status-provider';

describe('app/components/offline-status-provider', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the app offline until navigator.onLine and /api/ping both succeed', async () => {
    vi.stubGlobal('navigator', { onLine: true } as Navigator);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await expect(resolveOfflineStatus()).resolves.toBe(true);
  });

  it('returns offline when the browser is offline before pinging the backend', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('navigator', { onLine: false } as Navigator);
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveOfflineStatus()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
