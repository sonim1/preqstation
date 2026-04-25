import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('public/sw.js', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('deletes only older board/static cache versions managed by this service worker', async () => {
    const handlers = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const deleteMock = vi.fn().mockResolvedValue(true);
    const claimMock = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('caches', {
      delete: deleteMock,
      keys: vi.fn().mockResolvedValue([
        'preq-board-v2',
        'preq-static-v2',
        'preq-board-v1',
        'preq-static-v1',
        'preq-preview-v1',
        'other-app-v1',
      ]),
      match: vi.fn(),
      open: vi.fn(),
    });
    vi.stubGlobal('self', {
      addEventListener: vi.fn((type: string, handler: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
        handlers.set(type, handler);
      }),
      clients: {
        claim: claimMock,
      },
      location: {
        origin: 'https://example.com',
      },
      skipWaiting: vi.fn(),
    });

    await import('../public/sw.js');

    const activateHandler = handlers.get('activate');
    let activation: Promise<unknown> | null = null;

    activateHandler?.({
      waitUntil(promise) {
        activation = promise;
      },
    });

    await activation;

    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteMock).toHaveBeenNthCalledWith(1, 'preq-board-v1');
    expect(deleteMock).toHaveBeenNthCalledWith(2, 'preq-static-v1');
    expect(deleteMock).not.toHaveBeenCalledWith('preq-board-v2');
    expect(deleteMock).not.toHaveBeenCalledWith('preq-static-v2');
    expect(deleteMock).not.toHaveBeenCalledWith('preq-preview-v1');
    expect(deleteMock).not.toHaveBeenCalledWith('other-app-v1');
    expect(claimMock).toHaveBeenCalledTimes(1);
  });
});
