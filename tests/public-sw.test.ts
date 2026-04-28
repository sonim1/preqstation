import { beforeEach, describe, expect, it, vi } from 'vitest';

type CacheStore = Map<string, Map<string, Response>>;

type ServiceWorkerHarness = {
  addAllCalls: Array<{ cacheName: string; assets: string[] }>;
  cacheStore: CacheStore;
  claimMock: ReturnType<typeof vi.fn>;
  deleteMock: ReturnType<typeof vi.fn>;
  fetchMock: ReturnType<typeof vi.fn>;
  handlers: Map<string, (event: Record<string, unknown>) => void>;
  putCalls: Array<{ cacheName: string; key: string }>;
};

function normalizeCacheKey(input: string | { url: string }) {
  return typeof input === 'string' ? input : input.url;
}

async function loadServiceWorker({
  cacheNames = [],
  fetchMock = vi.fn(),
  seedCaches = [],
}: {
  cacheNames?: string[];
  fetchMock?: ReturnType<typeof vi.fn>;
  seedCaches?: Array<{ entries: Array<[string, Response]>; name: string }>;
} = {}): Promise<ServiceWorkerHarness> {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const cacheStore: CacheStore = new Map();
  const addAllCalls: Array<{ cacheName: string; assets: string[] }> = [];
  const putCalls: Array<{ cacheName: string; key: string }> = [];
  const deleteMock = vi.fn().mockResolvedValue(true);
  const claimMock = vi.fn().mockResolvedValue(undefined);

  for (const { entries, name } of seedCaches) {
    cacheStore.set(name, new Map(entries));
  }

  function ensureCache(name: string) {
    if (!cacheStore.has(name)) {
      cacheStore.set(name, new Map());
    }

    return cacheStore.get(name)!;
  }

  vi.stubGlobal('caches', {
    delete: deleteMock,
    keys: vi
      .fn()
      .mockImplementation(async () => [...new Set([...cacheNames, ...cacheStore.keys()])]),
    match: vi.fn().mockImplementation(async (key: string | { url: string }) => {
      const normalizedKey = normalizeCacheKey(key);

      for (const cache of cacheStore.values()) {
        const response = cache.get(normalizedKey);
        if (response) {
          return response.clone();
        }
      }

      return undefined;
    }),
    open: vi.fn().mockImplementation(async (name: string) => ({
      addAll: vi.fn().mockImplementation(async (assets: string[]) => {
        addAllCalls.push({ cacheName: name, assets });
        const cache = ensureCache(name);
        for (const asset of assets) {
          cache.set(asset, new Response(`precached:${asset}`));
        }
      }),
      put: vi.fn().mockImplementation(async (key: string | { url: string }, response: Response) => {
        const normalizedKey = normalizeCacheKey(key);
        putCalls.push({ cacheName: name, key: normalizedKey });
        ensureCache(name).set(normalizedKey, response.clone());
      }),
    })),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('self', {
    addEventListener: vi.fn((type: string, handler: (event: Record<string, unknown>) => void) => {
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

  // @ts-expect-error public/sw.js is a side-effect-only service worker script.
  await import('../public/sw.js');

  return {
    addAllCalls,
    cacheStore,
    claimMock,
    deleteMock,
    fetchMock,
    handlers,
    putCalls,
  };
}

async function dispatchWaitUntil(
  handler: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined,
): Promise<void> {
  let work: Promise<unknown> | null = null;

  handler?.({
    waitUntil(promise) {
      work = promise;
    },
  });

  await work;
}

async function dispatchFetch(
  handler:
    | ((event: {
        request: { method: string; mode: string; url: string };
        respondWith: (promise: Promise<Response>) => void;
      }) => void)
    | undefined,
  request: { method?: string; mode: string; url: string },
): Promise<Response> {
  let responsePromise: Promise<Response> | null = null;

  handler?.({
    request: {
      method: request.method ?? 'GET',
      mode: request.mode,
      url: request.url,
    },
    respondWith(promise) {
      responsePromise = promise;
    },
  });

  if (!responsePromise) {
    throw new Error('fetch handler did not respond');
  }

  return await responsePromise;
}

describe('public/sw.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('precaches the offline fallback shell during install', async () => {
    const sw = await loadServiceWorker();

    await dispatchWaitUntil(
      sw.handlers.get('install') as
        | ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void)
        | undefined,
    );

    expect(sw.addAllCalls).toContainEqual({
      cacheName: 'preq-static-v2',
      assets: expect.arrayContaining(['/manifest.webmanifest', '/offline.html']),
    });
  });

  it('deletes only older board/static cache versions managed by this service worker', async () => {
    const sw = await loadServiceWorker({
      cacheNames: [
        'preq-board-v2',
        'preq-static-v2',
        'preq-board-v1',
        'preq-static-v1',
        'preq-preview-v1',
        'other-app-v1',
      ],
    });

    await dispatchWaitUntil(
      sw.handlers.get('activate') as
        | ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void)
        | undefined,
    );

    expect(sw.deleteMock).toHaveBeenCalledTimes(2);
    expect(sw.deleteMock).toHaveBeenNthCalledWith(1, 'preq-board-v1');
    expect(sw.deleteMock).toHaveBeenNthCalledWith(2, 'preq-static-v1');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-board-v2');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-static-v2');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-preview-v1');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('other-app-v1');
    expect(sw.claimMock).toHaveBeenCalledTimes(1);
  });

  it('keeps serving a cached board navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-board-v2',
          entries: [['https://example.com/board/PQST', new Response('<html>cached board</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/board/PQST' },
    );

    expect(await response.text()).toBe('<html>cached board</html>');
  });

  it('serves the offline fallback shell for an uncached board navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v2',
          entries: [['/offline.html', new Response('<html>offline fallback</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/board/PQST' },
    );

    expect(await response.text()).toBe('<html>offline fallback</html>');
  });

  it('serves a cached /projects page when that navigation is retried offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-board-v2',
          entries: [['https://example.com/projects', new Response('<html>cached projects</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/projects' },
    );

    expect(await response.text()).toBe('<html>cached projects</html>');
  });

  it('serves the offline fallback shell for an uncached /projects navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v2',
          entries: [['/offline.html', new Response('<html>offline fallback</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/projects' },
    );

    expect(await response.text()).toBe('<html>offline fallback</html>');
  });

  it('serves the offline fallback shell for an uncached /projects/ navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v2',
          entries: [['/offline.html', new Response('<html>offline fallback</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/projects/' },
    );

    expect(await response.text()).toBe('<html>offline fallback</html>');
  });

  it('caches a successful /projects navigation for future offline reloads', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi
        .fn()
        .mockResolvedValue(new Response('<html>fresh projects</html>', { status: 200 })),
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/projects' },
    );

    expect(await response.text()).toBe('<html>fresh projects</html>');
    expect(sw.putCalls).toContainEqual({
      cacheName: 'preq-board-v2',
      key: 'https://example.com/projects',
    });
  });
});
