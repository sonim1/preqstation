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
const desktopColumnProps = vi.hoisted(() => ({
  current: [] as Array<Record<string, unknown>>,
}));
const dragDropContextProps = vi.hoisted(() => ({
  current: null as null | { onDragEnd?: (result: unknown) => void },
}));
const moveAnimation = vi.hoisted(() => ({
  captureCardRects: vi.fn(),
  playCardMoveAnimations: vi.fn(),
  events: [] as string[],
}));
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));
const mocked = vi.hoisted(() => ({
  storeState: {
    tasksByKey: {} as Record<string, KanbanTask>,
    taskKeysById: {} as Record<string, string>,
    columnTaskKeys: {
      inbox: [] as string[],
      todo: [] as string[],
      hold: [] as string[],
      ready: [] as string[],
      done: [] as string[],
      archived: [] as string[],
    },
    applyMove: vi.fn(
      (_taskId: string, _status: KanbanTask['status'], _index: number): string[] => [],
    ),
    applyOptimisticRunState: vi.fn(),
    hydrate: vi.fn(),
    removeTask: vi.fn(),
    upsertSnapshots: vi.fn(),
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
  DragDropContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd?: (result: unknown) => void;
  }) => {
    dragDropContextProps.current = { onDragEnd };
    return children;
  },
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
  useSearchParams: () => new URLSearchParams(),
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
  KanbanColumn: (props: Record<string, unknown>) => {
    desktopColumnProps.current.push(props);
    return React.createElement('section', { 'data-column-status': props.status as string });
  },
}));

vi.mock('@/app/components/use-kanban-card-move-animation', () => ({
  useKanbanCardMoveAnimation: () => ({
    captureCardRects: (container: HTMLElement | null) => {
      moveAnimation.events.push('capture');
      moveAnimation.captureCardRects(container);
    },
    playCardMoveAnimations: (container: HTMLElement | null) => {
      moveAnimation.events.push('play');
      moveAnimation.playCardMoveAnimations(container);
    },
  }),
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

function seedStoreColumns(columns: KanbanColumns) {
  mocked.storeState.tasksByKey = {};
  mocked.storeState.taskKeysById = {};
  mocked.storeState.columnTaskKeys = {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };

  for (const status of Object.keys(columns) as Array<keyof KanbanColumns>) {
    for (const task of columns[status]) {
      mocked.storeState.tasksByKey[task.taskKey] = task;
      mocked.storeState.taskKeysById[task.id] = task.taskKey;
      mocked.storeState.columnTaskKeys[status].push(task.taskKey);
    }
  }
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

function runHydrationEffect(serverColumns: KanbanColumns) {
  const hydrationEffect = useEffectMock.mock.calls.find(
    ([, deps]) => Array.isArray(deps) && deps.includes(serverColumns),
  )?.[0];
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
    desktopColumnProps.current = [];
    dragDropContextProps.current = null;
    moveAnimation.captureCardRects.mockReset();
    moveAnimation.playCardMoveAnimations.mockReset();
    moveAnimation.events = [];
    router.refresh.mockReset();
    router.push.mockReset();
    const columns = buildColumns();
    seedStoreColumns(columns);
    useKanbanColumnsMock.mockReturnValue(columns);
    mocked.storeState.applyMove.mockReset();
    mocked.storeState.applyMove.mockReturnValue([]);
    mocked.storeState.applyOptimisticRunState.mockReset();
    mocked.storeState.hydrate.mockReset();
    mocked.storeState.removeTask.mockReset();
    mocked.storeState.upsertSnapshots.mockReset();
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
    const serverColumns = buildColumns('BETA-1');
    mocked.storeState.focusedTask = buildFocusedTask({
      taskKey: 'ALPHA-1',
      projectId: 'project-alpha',
      title: 'Alpha task',
    });

    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={serverColumns}
        editHrefBase="/board/BETA"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={{ id: 'project-beta', name: 'Beta', projectKey: 'BETA' }}
        enginePresets={null}
      />,
    );

    runHydrationEffect(serverColumns);

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

  it('captures and schedules card move animations for desktop quick moves', () => {
    const task = makeTask({ id: 'task-1', taskKey: 'PROJ-1', status: 'todo' });
    const columns = {
      inbox: [],
      todo: [task],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    } satisfies KanbanColumns;
    seedStoreColumns(columns);
    useKanbanColumnsMock.mockReturnValue(columns);
    mocked.storeState.applyMove.mockImplementation((taskId, targetStatus) => {
      moveAnimation.events.push('applyMove');
      const taskKey = mocked.storeState.taskKeysById[taskId];
      const movedTask = mocked.storeState.tasksByKey[taskKey];
      if (!movedTask) {
        return [];
      }

      mocked.storeState.columnTaskKeys = {
        inbox: mocked.storeState.columnTaskKeys.inbox.filter((key) => key !== taskKey),
        todo: mocked.storeState.columnTaskKeys.todo.filter((key) => key !== taskKey),
        hold: mocked.storeState.columnTaskKeys.hold.filter((key) => key !== taskKey),
        ready: [
          ...mocked.storeState.columnTaskKeys.ready.filter((key) => key !== taskKey),
          taskKey,
        ],
        done: mocked.storeState.columnTaskKeys.done.filter((key) => key !== taskKey),
        archived: mocked.storeState.columnTaskKeys.archived.filter((key) => key !== taskKey),
      };
      mocked.storeState.tasksByKey = {
        ...mocked.storeState.tasksByKey,
        [taskKey]: { ...movedTask, status: targetStatus, sortOrder: 'z0' },
      };
      return [taskKey];
    });
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      moveAnimation.events.push('requestAnimationFrame');
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);

    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={columns}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={null}
        enginePresets={null}
      />,
    );

    const todoColumn = desktopColumnProps.current.find((props) => props.status === 'todo');
    const onQuickMoveTask = todoColumn?.onQuickMoveTask;
    if (typeof onQuickMoveTask !== 'function') {
      throw new Error('Expected desktop column to receive quick move handler.');
    }

    onQuickMoveTask('task-1', 'ready');

    expect(moveAnimation.captureCardRects).toHaveBeenCalledTimes(1);
    expect(mocked.storeState.applyMove).toHaveBeenCalledWith('task-1', 'ready', 0);
    expect(moveAnimation.playCardMoveAnimations).toHaveBeenCalledTimes(1);
    expect(moveAnimation.events).toEqual(['capture', 'applyMove', 'requestAnimationFrame', 'play']);
  });

  it('does not use custom move animations for direct drag and drop', () => {
    const task = makeTask({ id: 'task-1', taskKey: 'PROJ-1', status: 'todo' });
    const columns = {
      inbox: [],
      todo: [task],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    } satisfies KanbanColumns;
    seedStoreColumns(columns);
    useKanbanColumnsMock.mockReturnValue(columns);
    mocked.storeState.applyMove.mockImplementation(() => {
      moveAnimation.events.push('applyMove');
      return ['PROJ-1'];
    });

    renderToStaticMarkup(
      <KanbanBoard
        serverColumns={columns}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={null}
        enginePresets={null}
      />,
    );

    dragDropContextProps.current?.onDragEnd?.({
      source: { droppableId: 'todo', index: 0 },
      destination: { droppableId: 'ready', index: 0 },
    });

    expect(mocked.storeState.applyMove).toHaveBeenCalledWith('task-1', 'ready', 0);
    expect(moveAnimation.captureCardRects).not.toHaveBeenCalled();
    expect(moveAnimation.playCardMoveAnimations).not.toHaveBeenCalled();
    expect(moveAnimation.events).toEqual(['applyMove']);
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
