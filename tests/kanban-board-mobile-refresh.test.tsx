import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const refs: Array<{ current: unknown }> = [];
  const stateValues: unknown[] = [];

  return function renderBoard(
    overrides: Partial<React.ComponentProps<typeof KanbanBoardMobile>> = {},
  ) {
    let refIndex = 0;
    let stateIndex = 0;
    const effects: Array<() => void | (() => void)> = [];

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
    useEffectMock.mockReset();
    useRefMock.mockReset();
    useStateMock.mockReset();
    useMobilePullToRefreshMock.mockReset();
    notifications.showSuccessNotification.mockReset();

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

  it('keeps the indicator visible through refresh settle, swaps to success, then dismisses it', () => {
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
    vi.advanceTimersByTime(0);
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
