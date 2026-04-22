import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCallbackMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const applyOptimisticRunStateMock = vi.hoisted(() => vi.fn());
const getSnapshotMock = vi.hoisted(() => vi.fn());
const openFocusedTaskFromBoardTaskMock = vi.hoisted(() => vi.fn());
const setFocusedTaskMock = vi.hoisted(() => vi.fn());
const showErrorNotificationMock = vi.hoisted(() => vi.fn());
const upsertSnapshotsMock = vi.hoisted(() => vi.fn());
const useFocusedTaskDetailStatusMock = vi.hoisted(() => vi.fn());
const useFocusedTaskMock = vi.hoisted(() => vi.fn());
const useKanbanFocusedTaskKeyMock = vi.hoisted(() => vi.fn());
const useKanbanStoreApiMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: useCallbackMock,
    useEffect: useEffectMock,
  };
});

vi.mock('@/app/components/task-edit-panel', () => ({
  EmptyTaskEditPanel: () => <div data-testid="empty-task-edit-panel" />,
  TaskEditPanel: () => <div data-testid="task-edit-panel" />,
}));

vi.mock('@/app/components/kanban-store-provider', () => ({
  useApplyOptimisticKanbanRunState: () => applyOptimisticRunStateMock,
  useFocusedTask: useFocusedTaskMock,
  useFocusedTaskDetailStatus: useFocusedTaskDetailStatusMock,
  useKanbanFocusedTaskKey: useKanbanFocusedTaskKeyMock,
  useKanbanStoreApi: useKanbanStoreApiMock,
  useOpenFocusedTaskFromBoardTask: () => openFocusedTaskFromBoardTaskMock,
  useSetFocusedTask: () => setFocusedTaskMock,
  useUpsertKanbanSnapshots: () => upsertSnapshotsMock,
}));

vi.mock('@/lib/offline/snapshot-store', () => ({
  getSnapshot: getSnapshotMock,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: showErrorNotificationMock,
}));

import { BoardTaskPanel } from '@/app/components/board-task-panel';

describe('app/components/board-task-panel', () => {
  let effects: Array<() => void | (() => void)>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    effects = [];
    fetchMock = vi.fn();

    useCallbackMock.mockReset();
    useEffectMock.mockReset();
    applyOptimisticRunStateMock.mockReset();
    getSnapshotMock.mockReset();
    openFocusedTaskFromBoardTaskMock.mockReset();
    setFocusedTaskMock.mockReset();
    showErrorNotificationMock.mockReset();
    upsertSnapshotsMock.mockReset();
    useFocusedTaskDetailStatusMock.mockReset();
    useFocusedTaskMock.mockReset();
    useKanbanFocusedTaskKeyMock.mockReset();
    useKanbanStoreApiMock.mockReset();

    useCallbackMock.mockImplementation((callback: Function) => callback);
    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    useFocusedTaskMock.mockReturnValue({
      id: 'task-1',
      taskKey: 'PROJ-255',
      title: 'Preview task',
      branch: null,
      note: null,
      projectId: null,
      labelIds: [],
      labels: [],
      taskPriority: 'none',
      status: 'todo',
      engine: null,
      runState: null,
      runStateUpdatedAt: null,
      workLogs: [],
    });
    useFocusedTaskDetailStatusMock.mockReturnValue('loading');
    useKanbanFocusedTaskKeyMock.mockReturnValue('PROJ-255');
    useKanbanStoreApiMock.mockReturnValue({
      getState: () => ({
        tasksByKey: {},
      }),
    });
    getSnapshotMock.mockResolvedValue(null);

    vi.stubGlobal('fetch', fetchMock);
  });

  it('falls back to a stored task snapshot when the focused task fetch fails offline', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    getSnapshotMock.mockResolvedValue({
      id: 'task:PROJ-255',
      kind: 'task',
      entityKey: 'PROJ-255',
      payload: {
        id: 'task-1',
        taskKey: 'PROJ-255',
        title: 'Cached task',
        branch: null,
        note: '## Offline',
        projectId: null,
        labelIds: [],
        labels: [],
        taskPriority: 'none',
        status: 'todo',
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        workLogs: [],
      },
      updatedAt: '2026-04-21T00:00:00.000Z',
    });

    BoardTaskPanel({
      activePanel: 'task-edit',
      activeTaskKey: 'PROJ-255',
      boardHref: '/board',
      serverFocusedTask: null,
      projects: [],
      projectLabelOptionsByProjectId: {},
      taskPriorityOptions: [],
      updateTodoAction: async () => ({ ok: true }),
      telegramEnabled: false,
      onClose: vi.fn(),
    });

    effects.splice(0).forEach((effect) => {
      effect();
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(getSnapshotMock).toHaveBeenCalledWith('task:PROJ-255');
    expect(setFocusedTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PROJ-255',
        title: 'Cached task',
      }),
    );
    expect(showErrorNotificationMock).not.toHaveBeenCalled();
  });
});
