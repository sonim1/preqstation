import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useCallbackMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useStateMock = vi.hoisted(() => vi.fn());
const useMobilePullToRefreshMock = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({
  showSuccessNotification: vi.fn(),
}));

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

vi.mock('@/app/hooks/use-mobile-pull-to-refresh', () => ({
  useMobilePullToRefresh: useMobilePullToRefreshMock,
}));

vi.mock('@/app/hooks/use-mobile-tab-swipe', () => ({
  useMobileTabSwipe: () => ({ onTouchStart: vi.fn(), onTouchEnd: vi.fn() }),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => React.createElement('div', null, title),
}));

vi.mock('@/app/components/kanban-card', () => ({
  KanbanCardContent: () => React.createElement('div', null, 'card'),
}));

vi.mock('@/lib/notifications', () => notifications);

vi.mock('@tabler/icons-react', () => ({
  IconCircleCheck: () => null,
  IconEye: () => null,
  IconInbox: () => null,
  IconListCheck: () => null,
  IconPlayerPause: () => null,
  IconRefresh: ({ size }: { size?: number }) =>
    React.createElement('svg', {
      'data-testid': 'refresh-icon',
      'data-size': String(size ?? ''),
    }),
}));

import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';

function areDepsEqual(previous: readonly unknown[], next: readonly unknown[]) {
  return (
    previous.length === next.length &&
    previous.every((dependency, index) => Object.is(dependency, next[index]))
  );
}

function buildPullToRefreshState(overrides: Partial<ReturnType<typeof vi.fn>> = {}) {
  return {
    bindScrollContainer: vi.fn(),
    isArmed: false,
    pullDistance: 0,
    pullProgress: 0,
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onTouchCancel: vi.fn(),
    ...overrides,
  };
}

function createRenderHarness() {
  const callbacks: Array<{ deps: readonly unknown[]; value: unknown }> = [];
  const refs: Array<{ current: unknown }> = [];
  const stateValues: unknown[] = [];

  return function renderBoard(
    overrides: Partial<React.ComponentProps<typeof KanbanBoardMobile>> = {},
  ) {
    let callbackIndex = 0;
    let refIndex = 0;
    let stateIndex = 0;
    const effects: Array<() => void | (() => void)> = [];

    useCallbackMock.mockImplementation(<T,>(callback: T, deps: readonly unknown[]) => {
      const index = callbackIndex++;
      const previous = callbacks[index];

      if (previous && areDepsEqual(previous.deps, deps)) {
        return previous.value as T;
      }

      callbacks[index] = { deps, value: callback };
      return callback;
    });
    useRefMock.mockImplementation((initialValue: unknown) => {
      const index = refIndex++;
      refs[index] ??= { current: initialValue };
      return refs[index];
    });
    useStateMock.mockImplementation((initialValue: unknown) => {
      const index = stateIndex++;
      if (!(index in stateValues)) {
        stateValues[index] = initialValue;
      }

      return [
        stateValues[index],
        (value: unknown) => {
          stateValues[index] =
            typeof value === 'function'
              ? (value as (current: unknown) => unknown)(stateValues[index])
              : value;
        },
      ];
    });
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    const props: React.ComponentProps<typeof KanbanBoardMobile> = {
      columns: { inbox: [], todo: [], hold: [], ready: [], done: [], archived: [] },
      activeTab: 'inbox',
      onTabChange: () => {},
      isPending: false,
      editHrefBase: '/board',
      editHrefJoiner: '?',
      router: { push: vi.fn(), refresh: vi.fn() } as never,
      onRefresh: vi.fn(),
      onQuickMoveTask: vi.fn(),
      onDeleteTask: vi.fn(),
      saveError: null,
      enginePresets: null,
      ...overrides,
    };

    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile {...props} />
      </MantineProvider>,
    );

    return { effects, html, props };
  };
}

describe('KanbanBoardMobile refresh wiring', () => {
  beforeEach(() => {
    useCallbackMock.mockReset();
    useEffectMock.mockReset();
    useRefMock.mockReset();
    useStateMock.mockReset();
    useMobilePullToRefreshMock.mockReset();
    notifications.showSuccessNotification.mockReset();

    useCallbackMock.mockImplementation(<T,>(callback: T) => callback);
    useEffectMock.mockImplementation(() => undefined);
    useRefMock.mockImplementation((initialValue: unknown) => ({ current: initialValue }));
    useStateMock.mockImplementation((initialValue: unknown) => [initialValue, vi.fn()]);
    useMobilePullToRefreshMock.mockReturnValue(buildPullToRefreshState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the pull-to-refresh affordance on the active mobile lane', () => {
    useMobilePullToRefreshMock.mockReturnValue({
      ...buildPullToRefreshState(),
      isArmed: true,
      pullDistance: 40,
      pullProgress: 0.75,
    });

    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={{ inbox: [], todo: [], hold: [], ready: [], done: [], archived: [] }}
          activeTab="inbox"
          onTabChange={() => {}}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn(), refresh: vi.fn() } as never}
          onRefresh={vi.fn()}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          saveError={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(useMobilePullToRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeTab: 'inbox',
        disabled: false,
        onRefresh: expect.any(Function),
      }),
    );
    expect(html).toContain('kanban-mobile-refresh-indicator');
    expect(html).toContain('data-armed="true"');
    expect(html).toContain('--kanban-mobile-refresh-offset:40px');
    expect(html).toContain('--kanban-mobile-refresh-progress:0.75');
    expect(html).toContain('kanban-mobile-refresh-icon');
    expect(html).toContain('data-size="22"');
  });

  it('passes a stable refresh callback to the pull-to-refresh hook across rerenders', () => {
    const onRefresh = vi.fn();
    const renderBoard = createRenderHarness();

    renderBoard({ onRefresh });
    renderBoard({ onRefresh });

    const firstHookOptions = useMobilePullToRefreshMock.mock.calls[0]?.[0];
    const secondHookOptions = useMobilePullToRefreshMock.mock.calls[1]?.[0];
    expect(firstHookOptions?.onRefresh).toBe(secondHookOptions?.onRefresh);
  });

  it('keeps the indicator visible through refresh settle, swaps to success immediately, then dismisses it', () => {
    vi.useFakeTimers();

    const onRefresh = vi.fn();
    const renderBoard = createRenderHarness();

    renderBoard({ isPending: false, onRefresh });

    const pullToRefreshOptions = useMobilePullToRefreshMock.mock.calls.at(-1)?.[0];
    if (!pullToRefreshOptions) {
      throw new Error('Expected KanbanBoardMobile to configure pull-to-refresh.');
    }

    pullToRefreshOptions.onRefresh({ pullDistance: 40, pullProgress: 40 / 56 });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(notifications.showSuccessNotification).not.toHaveBeenCalled();

    let renderResult = renderBoard({ isPending: true, onRefresh });
    renderResult.effects.forEach((effect) => {
      effect();
    });
    expect(renderResult.html).toContain('data-state="refreshing"');
    expect(renderResult.html).toContain('data-visible="true"');
    expect(renderResult.html).toContain('--kanban-mobile-refresh-offset:40px');

    renderResult = renderBoard({ isPending: false, onRefresh });
    renderResult.effects.forEach((effect) => {
      effect();
    });
    renderResult = renderBoard({ isPending: false, onRefresh });
    expect(renderResult.html).toContain('data-state="success"');
    expect(notifications.showSuccessNotification).not.toHaveBeenCalled();

    vi.advanceTimersByTime(900);
    renderResult = renderBoard({ isPending: false, onRefresh });
    expect(renderResult.html).not.toContain('data-state="success"');
    expect(renderResult.html).not.toContain('data-visible="true"');
  });

  it('does not show inline success feedback for unrelated pending cycles', () => {
    const renderBoard = createRenderHarness();

    let renderResult = renderBoard({ isPending: false });
    renderResult.effects.forEach((effect) => {
      effect();
    });

    renderResult = renderBoard({ isPending: true });
    renderResult.effects.forEach((effect) => {
      effect();
    });

    renderResult = renderBoard({ isPending: false });
    renderResult.effects.forEach((effect) => {
      effect();
    });

    renderResult = renderBoard({ isPending: false });
    expect(renderResult.html).not.toContain('data-state="success"');
    expect(renderResult.html).not.toContain('data-state="refreshing"');
    expect(notifications.showSuccessNotification).not.toHaveBeenCalled();
  });
});
