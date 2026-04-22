import { beforeEach, describe, expect, it, vi } from 'vitest';

const useEffectMock = vi.hoisted(() => vi.fn());
const useCallbackMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const subscribePolledTaskEventsMock = vi.hoisted(() => vi.fn());
const useKanbanFocusedTaskKeyMock = vi.hoisted(() => vi.fn());
const useKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());
const removeTaskMock = vi.hoisted(() => vi.fn());
const setFocusedTaskMock = vi.hoisted(() => vi.fn());
const upsertSnapshotsMock = vi.hoisted(() => vi.fn());
const putSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: useCallbackMock,
    useEffect: useEffectMock,
    useRef: useRefMock,
  };
});

vi.mock('@/lib/event-poll-subscriptions', () => ({
  subscribePolledTaskEvents: subscribePolledTaskEventsMock,
}));

vi.mock('@/app/components/kanban-store-provider', () => ({
  useKanbanFocusedTaskKey: useKanbanFocusedTaskKeyMock,
  useKanbanReconciliationPaused: useKanbanReconciliationPausedMock,
  useRemoveKanbanTask: () => removeTaskMock,
  useSetFocusedTask: () => setFocusedTaskMock,
  useUpsertKanbanSnapshots: () => upsertSnapshotsMock,
}));

vi.mock('@/lib/offline/snapshot-store', () => ({
  putSnapshot: putSnapshotMock,
}));

import { BoardEventSync } from '@/app/components/board-event-sync';

describe('app/components/board-event-sync', () => {
  let effects: Array<() => void | (() => void)>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let refreshArchivedCountCalls: number;
  let subscriber: ((events: Array<Record<string, unknown>>) => Promise<boolean> | boolean) | null;
  let refValues: Array<{ current: unknown }>;
  let nextRefIndex: number;

  beforeEach(() => {
    effects = [];
    subscriber = null;
    fetchMock = vi.fn();
    refreshArchivedCountCalls = 0;
    refValues = [];
    nextRefIndex = 0;

    useEffectMock.mockReset();
    useCallbackMock.mockReset();
    useRefMock.mockReset();
    subscribePolledTaskEventsMock.mockReset();
    useKanbanFocusedTaskKeyMock.mockReset();
    useKanbanReconciliationPausedMock.mockReset();
    removeTaskMock.mockReset();
    setFocusedTaskMock.mockReset();
    upsertSnapshotsMock.mockReset();
    putSnapshotMock.mockReset();

    useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });
    useCallbackMock.mockImplementation((callback: Function) => callback);
    useRefMock.mockImplementation((initialValue: unknown) => {
      const index = nextRefIndex;
      nextRefIndex += 1;
      if (!refValues[index]) {
        refValues[index] = { current: initialValue };
      }
      return refValues[index];
    });
    useKanbanFocusedTaskKeyMock.mockReturnValue('PROJ-255');
    useKanbanReconciliationPausedMock.mockReturnValue(false);
    subscribePolledTaskEventsMock.mockImplementation(
      (nextSubscriber: (events: Array<Record<string, unknown>>) => Promise<boolean> | boolean) => {
        subscriber = nextSubscriber;
        return () => undefined;
      },
    );

    vi.stubGlobal('fetch', fetchMock);
  });

  function renderBoardEventSync(projectId = 'project-1') {
    nextRefIndex = 0;
    BoardEventSync({
      projectId,
      onArchivedCountRefresh: async () => {
        refreshArchivedCountCalls += 1;
      },
    });
    effects.splice(0).forEach((effect) => {
      effect();
    });
  }

  it('hydrates focused task work-log timestamps before updating the kanban store', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          todo: {
            id: 'task-1',
            taskKey: 'PROJ-255',
            title: 'Task',
            branch: 'task/proj-255/event-refresh',
            note: '## Context',
            projectId: 'project-1',
            labelIds: [],
            labels: [],
            taskPriority: 'none',
            status: 'todo',
            engine: null,
            runState: null,
            runStateUpdatedAt: null,
            workLogs: [
              {
                id: 'log-1',
                title: 'Updated task',
                detail: 'detail',
                engine: null,
                workedAt: '2026-03-24T00:00:00.000Z',
                createdAt: '2026-03-24T01:00:00.000Z',
                todo: { engine: null },
              },
            ],
          },
        }),
      });

    renderBoardEventSync();

    const handled = await subscriber?.([
      {
        id: 'event-1',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-255',
      },
    ]);

    expect(handled).toBe(true);
    expect(setFocusedTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PROJ-255',
        workLogs: [
          expect.objectContaining({
            workedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ],
      }),
    );
  });

  it('buffers task reconciliation while persistence is paused and flushes once after the pause clears', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: 'task-1',
              taskKey: 'PROJ-255',
              branch: null,
              title: 'Deferred snapshot',
              note: null,
              status: 'todo',
              sortOrder: 'a0',
              taskPriority: 'none',
              dueAt: null,
              engine: null,
              runState: null,
              runStateUpdatedAt: null,
              project: null,
              updatedAt: '2026-03-24T00:00:00.000Z',
              archivedAt: null,
              labels: [],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          todo: {
            id: 'task-1',
            taskKey: 'PROJ-255',
            title: 'Deferred snapshot',
            branch: 'task/proj-255/event-refresh',
            note: '## Context',
            projectId: 'project-1',
            labelIds: [],
            labels: [],
            taskPriority: 'none',
            status: 'todo',
            engine: null,
            runState: null,
            runStateUpdatedAt: null,
            workLogs: [],
          },
        }),
      });

    useKanbanReconciliationPausedMock.mockReturnValue(true);

    renderBoardEventSync();

    const handledWhilePaused = await subscriber?.([
      {
        id: 'event-1',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-255',
      },
      {
        id: 'event-2',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-255',
      },
      {
        id: 'event-3',
        eventType: 'TASK_DELETED',
        entityType: 'task',
        entityId: 'PROJ-256',
      },
      {
        id: 'event-4',
        eventType: 'TASK_DELETED',
        entityType: 'task',
        entityId: 'PROJ-256',
      },
    ]);

    expect(handledWhilePaused).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(removeTaskMock).not.toHaveBeenCalled();
    expect(upsertSnapshotsMock).not.toHaveBeenCalled();
    expect(setFocusedTaskMock).not.toHaveBeenCalled();

    useKanbanReconciliationPausedMock.mockReturnValue(false);

    renderBoardEventSync();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/todos/snapshots?taskKey=PROJ-255&projectId=project-1',
      { credentials: 'same-origin' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/todos/PROJ-255', {
      credentials: 'same-origin',
    });
    expect(removeTaskMock).toHaveBeenCalledTimes(1);
    expect(removeTaskMock).toHaveBeenCalledWith('PROJ-256');
    expect(upsertSnapshotsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        taskKey: 'PROJ-255',
        title: 'Deferred snapshot',
      }),
    ]);
    expect(putSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task:PROJ-255',
        kind: 'task',
        entityKey: 'PROJ-255',
      }),
    );
    expect(setFocusedTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PROJ-255',
      }),
    );
    expect(refreshArchivedCountCalls).toBe(1);
  });

  it('drops buffered task events when switching to a different project', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    });

    useKanbanReconciliationPausedMock.mockReturnValue(true);
    renderBoardEventSync('project-1');

    const handledWhilePaused = await subscriber?.([
      {
        id: 'event-1',
        eventType: 'TASK_UPDATED',
        entityType: 'task',
        entityId: 'PROJ-OLD',
      },
    ]);

    expect(handledWhilePaused).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    useKanbanReconciliationPausedMock.mockReturnValue(false);
    renderBoardEventSync('project-2');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(removeTaskMock).not.toHaveBeenCalled();
    expect(upsertSnapshotsMock).not.toHaveBeenCalled();
    expect(setFocusedTaskMock).not.toHaveBeenCalled();
  });
});
