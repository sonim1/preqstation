import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

const useStateMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const useMemoMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useCallbackMock = vi.hoisted(() => vi.fn());
const useTransitionMock = vi.hoisted(() => vi.fn());
const useKanbanColumnsMock = vi.hoisted(() => vi.fn());
const setKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: useStateMock,
    useEffect: useEffectMock,
    useMemo: useMemoMock,
    useRef: useRefMock,
    useCallback: useCallbackMock,
    useTransition: useTransitionMock,
  };
});

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: () => null,
  Button: () => null,
  Group: () => null,
  Modal: () => null,
  Stack: () => null,
  Text: () => null,
  Tooltip: ({ children }: { children?: ReactNode }) => children ?? null,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArchive: () => null,
  IconPlus: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/kanban-persistence', () => ({
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

vi.mock('@/app/components/kanban-store-provider', () => ({
  useKanbanColumns: useKanbanColumnsMock,
  useKanbanStoreApi: () => ({
    getState: () => ({
      applyMove: vi.fn(() => []),
      applyOptimisticRunState: vi.fn(),
      hydrate: vi.fn(),
      removeTask: vi.fn(),
      upsertSnapshots: vi.fn(),
      focusedTask: null,
    }),
  }),
  useOpenFocusedTaskFromBoardTask: () => vi.fn(),
  useSetKanbanReconciliationPaused: () => setKanbanReconciliationPausedMock,
}));

vi.mock('@/app/components/kanban-archive-drawer', () => ({
  KanbanArchiveDrawer: () => null,
}));

vi.mock('@/app/components/kanban-board-mobile', () => ({
  KanbanBoardMobile: () => null,
}));

vi.mock('@/app/components/kanban-column', () => ({
  KanbanColumn: () => null,
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
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

import { KanbanBoard } from '@/app/components/kanban-board';

function makeTask(
  overrides: Partial<KanbanTask> & { id: string; taskKey: string; status: KanbanTask['status'] },
): KanbanTask {
  const { id, taskKey, status, ...rest } = overrides;

  return {
    id,
    taskKey,
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

function emptyColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function mockBoardState(params: {
  columns: KanbanColumns;
  activeTab: string;
  setActiveTab: ReturnType<typeof vi.fn>;
  setIsMobile: ReturnType<typeof vi.fn>;
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
    .mockReturnValueOnce([true, params.setIsMobile])
    .mockReturnValueOnce([params.activeTab, params.setActiveTab]);

  useRefMock.mockImplementation((initialValue: unknown) => {
    if (initialValue === params.columns) {
      return { current: params.columns };
    }
    if (Array.isArray(initialValue)) {
      return { current: initialValue };
    }
    if (typeof initialValue === 'boolean') {
      return { current: initialValue };
    }
    return {
      current: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        clientWidth: 0,
        scrollLeft: 0,
        scrollWidth: 0,
      },
    };
  });
}

describe('app/components/kanban-board mobile tab selection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useStateMock.mockReset();
    useEffectMock.mockReset();
    useMemoMock.mockReset();
    useRefMock.mockReset();
    useCallbackMock.mockReset();
    useTransitionMock.mockReset();
    useKanbanColumnsMock.mockReset();
    router.refresh.mockReset();

    useMemoMock.mockImplementation((factory: () => unknown) => factory());
    useCallbackMock.mockImplementation(<T,>(callback: T) => callback);
    useTransitionMock.mockReturnValue([false, vi.fn()]);
  });

  it('keeps the selected mobile tab when that column is empty', () => {
    const columns = {
      ...emptyColumns(),
      inbox: [makeTask({ id: '1', taskKey: 'PROJ-1', status: 'inbox' })],
    };
    const setActiveTab = vi.fn();
    const setIsMobile = vi.fn();
    const effects: Array<() => void> = [];

    mockBoardState({ columns, activeTab: 'todo', setActiveTab, setIsMobile });
    useEffectMock.mockImplementation((effect: () => void) => {
      effects.push(effect);
    });

    KanbanBoard({
      initialInboxTasks: columns.inbox,
      initialTodoTasks: columns.todo,
      initialHoldTasks: columns.hold,
      initialReadyTasks: columns.ready,
      initialDoneTasks: columns.done,
      initialArchivedTasks: columns.archived,
      editHrefBase: '/board',
      projectOptions: [],
      labelOptions: [],
      selectedProject: null,
      enginePresets: null,
    });

    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    for (const effect of effects) {
      effect();
    }

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(setIsMobile).toHaveBeenCalledWith(true);
  });

  it('falls back to Planned when the active mobile tab is no longer visible', () => {
    const columns = {
      ...emptyColumns(),
      inbox: [makeTask({ id: '1', taskKey: 'PROJ-1', status: 'inbox' })],
    };
    const setActiveTab = vi.fn();
    const setIsMobile = vi.fn();
    const effects: Array<() => void> = [];

    mockBoardState({ columns, activeTab: 'archived', setActiveTab, setIsMobile });
    useEffectMock.mockImplementation((effect: () => void) => {
      effects.push(effect);
    });

    KanbanBoard({
      initialInboxTasks: columns.inbox,
      initialTodoTasks: columns.todo,
      initialHoldTasks: columns.hold,
      initialReadyTasks: columns.ready,
      initialDoneTasks: columns.done,
      initialArchivedTasks: columns.archived,
      editHrefBase: '/board',
      projectOptions: [],
      labelOptions: [],
      selectedProject: null,
      enginePresets: null,
    });

    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    for (const effect of effects) {
      effect();
    }

    expect(setActiveTab).toHaveBeenCalledWith('todo');
    expect(setIsMobile).toHaveBeenCalledWith(true);
  });

  it('does not force the mobile tab to Planned when queueing a task outside todo', () => {
    const columns = {
      ...emptyColumns(),
      inbox: [makeTask({ id: '1', taskKey: 'PROJ-1', status: 'inbox' })],
    };
    const setActiveTab = vi.fn();
    const setIsMobile = vi.fn();
    const effects: Array<() => void> = [];

    mockBoardState({ columns, activeTab: 'inbox', setActiveTab, setIsMobile });
    useEffectMock.mockImplementation((effect: () => void) => {
      effects.push(effect);
    });

    KanbanBoard({
      initialInboxTasks: columns.inbox,
      initialTodoTasks: columns.todo,
      initialHoldTasks: columns.hold,
      initialReadyTasks: columns.ready,
      initialDoneTasks: columns.done,
      initialArchivedTasks: columns.archived,
      editHrefBase: '/board',
      projectOptions: [],
      labelOptions: [],
      selectedProject: null,
      enginePresets: null,
      optimisticQueuedTask: {
        taskKey: 'PROJ-1',
        queuedAt: '2026-03-22T23:35:00.000Z',
      },
    });

    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    });

    for (const effect of effects) {
      effect();
    }

    expect(setActiveTab).not.toHaveBeenCalledWith('todo');
    expect(setIsMobile).toHaveBeenCalledWith(true);
  });
});
