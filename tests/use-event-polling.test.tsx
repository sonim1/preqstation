import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCallbackMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useStateMock = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));
const publishPolledTaskEventsMock = vi.hoisted(() => vi.fn());
const consumePendingTaskEditRefreshMock = vi.hoisted(() => vi.fn());
const getTaskEditRefreshStateMock = vi.hoisted(() => vi.fn());
const markPendingTaskEditRefreshMock = vi.hoisted(() => vi.fn());
const subscribeTaskEditRefreshMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: useCallbackMock,
    useEffect: useEffectMock,
    useRef: useRefMock,
    useState: useStateMock,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/task-edit-refresh-guard', () => ({
  consumePendingTaskEditRefresh: consumePendingTaskEditRefreshMock,
  getTaskEditRefreshState: getTaskEditRefreshStateMock,
  markPendingTaskEditRefresh: markPendingTaskEditRefreshMock,
  subscribeTaskEditRefresh: subscribeTaskEditRefreshMock,
}));

vi.mock('@/lib/event-poll-subscriptions', () => ({
  publishPolledTaskEvents: publishPolledTaskEventsMock,
}));

import { useEventPolling } from '@/app/hooks/use-event-polling';

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('app/hooks/use-event-polling', () => {
  let effects: Array<() => void | (() => void)>;
  let addEventListener: ReturnType<typeof vi.fn>;
  let clearIntervalMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let removeEventListener: ReturnType<typeof vi.fn>;
  let sessionStorageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
  };
  let setIntervalMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    effects = [];
    addEventListener = vi.fn();
    clearIntervalMock = vi.fn();
    fetchMock = vi.fn();
    removeEventListener = vi.fn();
    setIntervalMock = vi.fn(() => 1);
    sessionStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };

    router.refresh.mockReset();
    publishPolledTaskEventsMock.mockReset();
    consumePendingTaskEditRefreshMock.mockReset();
    getTaskEditRefreshStateMock.mockReset();
    markPendingTaskEditRefreshMock.mockReset();
    subscribeTaskEditRefreshMock.mockReset();
    useCallbackMock.mockReset();
    useEffectMock.mockReset();
    useRefMock.mockReset();
    useStateMock.mockReset();

    useCallbackMock.mockImplementation(<T,>(callback: T) => callback);
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    const refs: Array<{ current: unknown }> = [];
    let refIndex = 0;
    useRefMock.mockImplementation((initialValue: unknown) => {
      const currentIndex = refIndex++;
      if (!refs[currentIndex]) {
        refs[currentIndex] = { current: initialValue };
      }
      return refs[currentIndex];
    });

    useStateMock.mockImplementation((initialValue: unknown) => [initialValue, vi.fn()]);

    publishPolledTaskEventsMock.mockResolvedValue(false);
    getTaskEditRefreshStateMock.mockReturnValue({ blocked: false, pending: false });
    subscribeTaskEditRefreshMock.mockReturnValue(() => undefined);

    vi.stubGlobal('clearInterval', clearIntervalMock);
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener,
      removeEventListener,
    } as unknown as Document);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'sessionStorage',
      sessionStorageMock as unknown as typeof globalThis.sessionStorage,
    );
    vi.stubGlobal('setInterval', setIntervalMock);
  });

  it('dispatches polled events to board subscribers before route refresh fallback', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ id: 'event-1', entityType: 'task', entityId: 'PROJ-255' }],
        nextCursor: '12',
      }),
    });
    publishPolledTaskEventsMock.mockResolvedValue(true);

    useEventPolling({ projectId: 'project-1', intervalMs: 1000 });
    effects.forEach((effect) => {
      effect();
    });
    await flushAsyncWork();

    expect(publishPolledTaskEventsMock).toHaveBeenCalledWith([
      { id: 'event-1', entityType: 'task', entityId: 'PROJ-255' },
    ]);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(markPendingTaskEditRefreshMock).not.toHaveBeenCalled();
  });

  it('dispatches notification events to subscribers before route refresh fallback', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'event-9',
            eventType: 'NOTIFICATION_CREATED',
            entityType: 'notification',
            entityId: 'notif-1',
            payload: { taskKey: 'PROJ-327' },
          },
        ],
        nextCursor: '99',
      }),
    });
    publishPolledTaskEventsMock.mockResolvedValue(true);

    useEventPolling({ intervalMs: 1000 });
    effects.forEach((effect) => {
      effect();
    });
    await flushAsyncWork();

    expect(publishPolledTaskEventsMock).toHaveBeenCalledWith([
      {
        id: 'event-9',
        eventType: 'NOTIFICATION_CREATED',
        entityType: 'notification',
        entityId: 'notif-1',
        payload: { taskKey: 'PROJ-327' },
      },
    ]);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('does not call router.refresh while task-edit refresh is blocked', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ id: 'event-1' }],
        nextCursor: '12',
      }),
    });
    getTaskEditRefreshStateMock.mockReturnValue({ blocked: true, pending: false });
    publishPolledTaskEventsMock.mockResolvedValue(false);

    useEventPolling({ projectId: 'project-1', intervalMs: 1000 });
    effects.forEach((effect) => {
      effect();
    });
    await flushAsyncWork();

    expect(router.refresh).not.toHaveBeenCalled();
    expect(markPendingTaskEditRefreshMock).toHaveBeenCalledTimes(1);
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('event-poll-cursor', '12');
  });

  it('flushes exactly one refresh after the guard is released', () => {
    const subscriberRef: { current: (() => void) | null } = { current: null };
    subscribeTaskEditRefreshMock.mockImplementation((listener: () => void) => {
      subscriberRef.current = listener;
      return () => undefined;
    });
    consumePendingTaskEditRefreshMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    getTaskEditRefreshStateMock.mockReturnValue({ blocked: true, pending: true });

    useEventPolling({ intervalMs: 1000 });
    effects.forEach((effect) => {
      effect();
    });

    getTaskEditRefreshStateMock.mockReturnValue({ blocked: false, pending: true });
    const subscriber = subscriberRef.current;
    if (subscriber) subscriber();
    if (subscriber) subscriber();

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
