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
      cacheName: 'preq-static-v3',
      assets: expect.arrayContaining([
        '/manifest.webmanifest',
        '/offline.html',
        '/brand/preqstation-app-icon.svg',
      ]),
    });
  });

  it('deletes only older board/static cache versions managed by this service worker', async () => {
    const sw = await loadServiceWorker({
      cacheNames: [
        'preq-board-v3',
        'preq-static-v3',
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
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-board-v3');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-static-v3');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('preq-preview-v1');
    expect(sw.deleteMock).not.toHaveBeenCalledWith('other-app-v1');
    expect(sw.claimMock).toHaveBeenCalledTimes(1);
  });

  it('caches Next.js hashed JS and CSS chunks for offline board reloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('console.log("board")'))
      .mockResolvedValueOnce(new Response('.board{}'));
    const sw = await loadServiceWorker({ fetchMock });

    const jsResponse = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'no-cors', url: 'https://example.com/_next/static/chunks/app-board.abc123.js' },
    );
    const cssResponse = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'no-cors', url: 'https://example.com/_next/static/css/app-board.def456.css' },
    );

    expect(await jsResponse.text()).toBe('console.log("board")');
    expect(await cssResponse.text()).toBe('.board{}');
    expect(sw.putCalls).toEqual([
      {
        cacheName: 'preq-static-v3',
        key: 'https://example.com/_next/static/chunks/app-board.abc123.js',
      },
      {
        cacheName: 'preq-static-v3',
        key: 'https://example.com/_next/static/css/app-board.def456.css',
      },
    ]);
  });

  it('keeps serving a cached board navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-board-v3',
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

  it('keeps serving a cached /dashboard page when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-board-v3',
          entries: [
            ['https://example.com/dashboard', new Response('<html>cached dashboard</html>')],
          ],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/dashboard' },
    );

    expect(await response.text()).toBe('<html>cached dashboard</html>');
  });

  it('serves the offline fallback shell for an uncached /dashboard navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v3',
          entries: [['/offline.html', new Response('<html>offline fallback</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/dashboard' },
    );

    expect(await response.text()).toBe('<html>offline fallback</html>');
  });

  it('serves the offline fallback shell for the uncached root start navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v3',
          entries: [['/offline.html', new Response('<html>offline fallback</html>')]],
        },
      ],
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/' },
    );

    expect(await response.text()).toBe('<html>offline fallback</html>');
  });

  it('serves the offline fallback shell for an uncached board navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v3',
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
          name: 'preq-board-v3',
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

  it('serves cached /projects navigation when the network does not answer within 2.5 seconds', async () => {
    vi.useFakeTimers();
    const sw = await loadServiceWorker({
      fetchMock: vi.fn(() => new Promise<Response>(() => undefined)),
      seedCaches: [
        {
          name: 'preq-board-v3',
          entries: [['https://example.com/projects', new Response('<html>cached projects</html>')]],
        },
      ],
    });

    const responsePromise = dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/projects' },
    );

    await vi.advanceTimersByTimeAsync(2_500);
    const response = await responsePromise;

    expect(await response.text()).toBe('<html>cached projects</html>');
    vi.useRealTimers();
  });

  it('serves the offline fallback shell for an uncached /projects navigation when the network is offline', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi.fn().mockRejectedValue(new TypeError('offline')),
      seedCaches: [
        {
          name: 'preq-static-v3',
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
          name: 'preq-static-v3',
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
      cacheName: 'preq-board-v3',
      key: 'https://example.com/projects',
    });
  });

  it('caches a successful /dashboard navigation for future offline reloads', async () => {
    const sw = await loadServiceWorker({
      fetchMock: vi
        .fn()
        .mockResolvedValue(new Response('<html>fresh dashboard</html>', { status: 200 })),
    });

    const response = await dispatchFetch(
      sw.handlers.get('fetch') as Parameters<typeof dispatchFetch>[0],
      { mode: 'navigate', url: 'https://example.com/dashboard' },
    );

    expect(await response.text()).toBe('<html>fresh dashboard</html>');
    expect(sw.putCalls).toContainEqual({
      cacheName: 'preq-board-v3',
      key: 'https://example.com/dashboard',
    });
  });
});
