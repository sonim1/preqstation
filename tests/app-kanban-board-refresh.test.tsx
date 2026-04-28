import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';

const useStateMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useTransitionMock = vi.hoisted(() => vi.fn());
const useKanbanColumnsMock = vi.hoisted(() => vi.fn());
const setKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());
const mobileBoardProps = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));
const mocked = vi.hoisted(() => ({
  storeState: {
    applyMove: vi.fn(() => []),
    applyOptimisticRunState: vi.fn(),
    hydrate: vi.fn(),
    removeTask: vi.fn(),
    focusedTask: null as EditableBoardTask | null,
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: useStateMock,
    useEffect: useEffectMock,
    useTransition: useTransitionMock,
  };
});

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Modal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArchive: () => null,
  IconBulb: () => null,
  IconPlus: () => null,
  IconSettings: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/app/components/kanban-store-provider', () => ({
  useKanbanColumns: useKanbanColumnsMock,
  useKanbanStoreApi: () => ({
    getState: () => mocked.storeState,
  }),
  useOpenFocusedTaskFromBoardTask: () => vi.fn(),
  useSetKanbanReconciliationPaused: () => setKanbanReconciliationPausedMock,
}));

vi.mock('@/lib/kanban-persistence', () => ({
  collectRecoveryTaskKeys: vi.fn(() => []),
  drainKanbanMutationQueue: vi.fn(),
  shouldApplyKanbanServerSnapshot: vi.fn(() => true),
  shouldRefreshKanbanAfterPersist: vi.fn(() => false),
}));

vi.mock('@/lib/match-media', () => ({
  subscribeMediaQuery: vi.fn(() => () => {}),
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

vi.mock('@/app/components/kanban-archive-drawer', () => ({
  KanbanArchiveDrawer: () => null,
}));

vi.mock('@/app/components/kanban-board-mobile', () => ({
  KanbanBoardMobile: (props: Record<string, unknown>) => {
    mobileBoardProps.current = props;
    return null;
  },
}));

vi.mock('@/app/components/kanban-column', () => ({
  KanbanColumn: () => null,
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
}));

vi.mock('@/app/components/project-insight-modal', () => ({
  ProjectInsightModal: () => null,
}));

vi.mock('@/app/components/ready-qa-actions', () => ({
  ReadyQaActions: () => null,
}));

vi.mock('@/app/components/board-search-context', () => ({
  useBoardSearchQuery: () => ({ query: '', setQuery: vi.fn() }),
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    task: {
      singular: 'Task',
      singularLower: 'task',
      plural: 'Tasks',
      pluralLower: 'tasks',
    },
    agents: {
      plural: 'AI agents',
      pluralLower: 'AI agents',
    },
    statuses: {
      inbox: 'Inbox',
      todo: 'Todo',
      hold: 'Hold',
      ready: 'Ready',
      done: 'Done',
      archived: 'Archived',
    },
    boardStatuses: {
      inbox: 'Inbox',
      todo: 'Planned',
      hold: 'Hold',
      ready: 'Ready',
      done: 'Done',
    },
  }),
}));

import { KanbanBoard, resolveKanbanWheelAction } from '@/app/components/kanban-board';

function makeTask(
  overrides: Partial<KanbanTask> & { id: string; taskKey: string; status: KanbanTask['status'] },
): KanbanTask {
  const { id, taskKey, status, ...rest } = overrides;

  return {
    id,
    taskKey,
    branch: null,
    title: 'Task',
    note: null,
    status,
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date('2026-03-09T00:00:00.000Z').toISOString(),
    archivedAt: null,
    labels: [],
    ...rest,
  };
}

function buildColumns(taskKey = 'PROJ-1'): KanbanColumns {
  return {
    inbox: [],
    todo: [makeTask({ id: `task-${taskKey}`, taskKey, status: 'todo' })],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function buildFocusedTask(
  overrides: Partial<EditableBoardTask> & { taskKey: string; projectId: string | null },
): EditableBoardTask {
  const { taskKey, projectId, ...rest } = overrides;

  return {
    id: `focused-${taskKey}`,
    taskKey,
    title: 'Focused task',
    branch: `task/${taskKey.toLowerCase()}/focused-task`,
    note: '## Context',
    projectId,
    labelIds: [],
    labels: [],
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    dispatchTarget: null,
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
    ...rest,
  };
}

function mockMobileBoardState(params: {
  columns: KanbanColumns;
  activeTab?: string;
  setActiveTab?: ReturnType<typeof vi.fn>;
  setIsMobile?: ReturnType<typeof vi.fn>;
}) {
  useKanbanColumnsMock.mockReturnValue(params.columns);

  useStateMock
    .mockReturnValueOnce([null, vi.fn()])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce(['', vi.fn()])
    .mockReturnValueOnce([
      {
        tasks: [],
        total: 0,
        nextOffset: 0,
        hasMore: false,
      },
      vi.fn(),
    ])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([null, vi.fn()])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([null, vi.fn()])
    .mockReturnValueOnce([true, params.setIsMobile ?? vi.fn()])
    .mockReturnValueOnce([params.activeTab ?? 'todo', params.setActiveTab ?? vi.fn()]);
}

function runHydrationEffect() {
  const hydrationEffect = useEffectMock.mock.calls[2]?.[0];
  if (typeof hydrationEffect !== 'function') {
    throw new Error('Expected the server snapshot hydration effect to be registered.');
  }

  hydrationEffect();
}

describe('app/components/kanban-board store hydration', () => {
  beforeEach(() => {
    useStateMock.mockReset();
    useEffectMock.mockReset();
    useTransitionMock.mockReset();
    useKanbanColumnsMock.mockReset();
    mobileBoardProps.current = null;
    router.refresh.mockReset();
    router.push.mockReset();
    useKanbanColumnsMock.mockReturnValue(buildColumns());
    mocked.storeState.applyMove.mockReset();
    mocked.storeState.applyOptimisticRunState.mockReset();
    mocked.storeState.hydrate.mockReset();
    mocked.storeState.removeTask.mockReset();
    mocked.storeState.focusedTask = null;

    useStateMock.mockImplementation((initialValue: unknown) => [
      typeof initialValue === 'function' ? (initialValue as () => unknown)() : initialValue,
      vi.fn(),
    ]);
    useEffectMock.mockImplementation(() => undefined);
    useTransitionMock.mockReturnValue([false, vi.fn()]);
  });

  it('renders KanbanBoard columns from store selectors instead of local canonical state', () => {
    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={buildColumns()}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={null}
        enginePresets={null}
      />,
    );

    expect(useKanbanColumnsMock).toHaveBeenCalled();
  });

  it('clears a stale focused task when hydrating a different project board', () => {
    mocked.storeState.focusedTask = buildFocusedTask({
      taskKey: 'ALPHA-1',
      projectId: 'project-alpha',
      title: 'Alpha task',
    });

    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={buildColumns('BETA-1')}
        editHrefBase="/board/BETA"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={{ id: 'project-beta', name: 'Beta', projectKey: 'BETA' }}
        enginePresets={null}
      />,
    );

    runHydrationEffect();

    expect(mocked.storeState.hydrate).toHaveBeenCalledWith(
      expect.objectContaining({
        focusedTask: null,
        columns: expect.objectContaining({
          todo: [expect.objectContaining({ taskKey: 'BETA-1' })],
        }),
      }),
    );
  });

  it('routes mobile refresh through startTransition before refreshing the router', () => {
    const events: string[] = [];
    const startTransition = vi.fn((callback: () => void) => {
      events.push('transition');
      callback();
    });

    useTransitionMock.mockReturnValue([false, startTransition]);
    router.refresh.mockImplementation(() => {
      events.push('refresh');
    });
    mockMobileBoardState({ columns: buildColumns('MOBILE-1'), activeTab: 'todo' });

    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={buildColumns('MOBILE-1')}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={null}
        enginePresets={null}
      />,
    );

    expect(mobileBoardProps.current).toEqual(
      expect.objectContaining({
        onRefresh: expect.any(Function),
        isPending: false,
      }),
    );

    const onRefresh = mobileBoardProps.current?.onRefresh;
    if (typeof onRefresh !== 'function') {
      throw new Error('Expected KanbanBoard to pass a mobile refresh callback.');
    }

    onRefresh();

    expect(startTransition).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['transition', 'refresh']);
  });
});

describe('resolveKanbanWheelAction', () => {
  it('absorbs upward wheel deltas when a column is already at scrollTop 0', () => {
    expect(
      resolveKanbanWheelAction({
        deltaX: 0,
        deltaY: -48,
        boardScrollLeft: 0,
        boardClientWidth: 960,
        boardScrollWidth: 1320,
        columnScrollTop: 0,
        columnClientHeight: 320,
        columnScrollHeight: 860,
      }),
    ).toEqual({ preventDefault: true, nextScrollLeft: 0 });
  });

  it('keeps native vertical scrolling when the column can still move in that direction', () => {
    expect(
      resolveKanbanWheelAction({
        deltaX: 0,
        deltaY: -48,
        boardScrollLeft: 0,
        boardClientWidth: 960,
        boardScrollWidth: 1320,
        columnScrollTop: 64,
        columnClientHeight: 320,
        columnScrollHeight: 860,
      }),
    ).toEqual({ preventDefault: false, nextScrollLeft: 0 });
  });

  it('keeps horizontal-dominant trackpad input mapped onto the board rail', () => {
    expect(
      resolveKanbanWheelAction({
        deltaX: 36,
        deltaY: 12,
        boardScrollLeft: 120,
        boardClientWidth: 960,
        boardScrollWidth: 1320,
        columnScrollTop: 64,
        columnClientHeight: 320,
        columnScrollHeight: 860,
      }),
    ).toEqual({ preventDefault: true, nextScrollLeft: 156 });
  });
});
