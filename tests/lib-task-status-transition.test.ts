import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tasks, workLogs } from '@/lib/db/schema';

const mocked = vi.hoisted(() => {
  const insertReturningFn = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
  const insertValuesFn = vi.fn().mockReturnValue({ returning: insertReturningFn });
  const updateWhereFn = vi.fn().mockResolvedValue([{ id: 'task-1' }]);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });

  return {
    safeCreateTaskCompletionNotification: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    insertReturningFn,
    insertValuesFn,
    updateWhereFn,
    updateSetFn,
    tx: {
      insert: vi.fn().mockReturnValue({ values: insertValuesFn }),
      update: vi.fn().mockReturnValue({ set: updateSetFn }),
    },
  };
});

vi.mock('@/lib/task-notifications', () => ({
  safeCreateTaskCompletionNotification: mocked.safeCreateTaskCompletionNotification,
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_TASK: 'task',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  writeOutboxEventStandalone: mocked.writeOutboxEventStandalone,
}));

import { applyBoardTaskStatusTransition } from '@/lib/task-status-transition';

describe('lib/task-status-transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.safeCreateTaskCompletionNotification.mockResolvedValue(null);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.tx.insert.mockReturnValue({ values: mocked.insertValuesFn });
    mocked.insertValuesFn.mockReturnValue({ returning: mocked.insertReturningFn });
    mocked.insertReturningFn.mockResolvedValue([{ id: 'log-1' }]);
    mocked.tx.update.mockReturnValue({ set: mocked.updateSetFn });
    mocked.updateSetFn.mockReturnValue({ where: mocked.updateWhereFn });
    mocked.updateWhereFn.mockResolvedValue([{ id: 'task-1' }]);
  });

  it('writes the status work log, notification, outbox event, and returns Kanban task data', async () => {
    const result = await applyBoardTaskStatusTransition({
      tx: mocked.tx as never,
      ownerId: 'owner-1',
      projectId: 'project-1',
      existingTask: {
        id: 'task-1',
        taskKey: 'PROJ-1',
        branch: 'task/proj-1/task-a',
        title: 'Task A',
        note: null,
        status: 'ready',
        sortOrder: 'b0',
        taskPriority: 'none',
        dueAt: null,
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-04-10T14:00:00.000Z'),
        projectId: 'project-1',
        updatedAt: new Date('2026-04-10T14:05:00.000Z'),
        archivedAt: null,
        project: { id: 'project-1', name: 'Project A', projectKey: 'PROJ' },
        labels: [{ id: 'label-1', name: 'Frontend', color: 'emerald' }],
      },
      nextTask: {
        title: 'Task A',
        note: null,
        status: 'done',
        sortOrder: 'c0',
        taskPriority: 'none',
        dueAt: null,
        labelId: 'label-1',
        labels: [{ id: 'label-1', name: 'Frontend', color: 'emerald' }],
      },
      now: new Date('2026-04-10T14:10:00.000Z'),
    });

    expect(mocked.tx.update).toHaveBeenCalledWith(tasks);
    expect(mocked.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
        sortOrder: 'c0',
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
      }),
    );
    expect(mocked.tx.insert).toHaveBeenCalledWith(workLogs);
    expect(mocked.insertValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        taskId: 'task-1',
        engine: null,
      }),
    );
    expect(mocked.safeCreateTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        ownerId: 'owner-1',
        projectId: 'project-1',
        taskId: 'task-1',
        taskKey: 'PROJ-1',
        taskTitle: 'Task A',
        fromStatus: 'ready',
        toStatus: 'done',
        previousRunState: 'running',
        nextRunState: null,
      }),
    );
    expect(mocked.writeOutboxEventStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        eventType: 'TASK_STATUS_CHANGED',
        entityType: 'task',
        entityId: 'PROJ-1',
        payload: { from: 'ready', to: 'done' },
      }),
      mocked.tx,
    );
    expect(result).toEqual(
      expect.objectContaining({
        taskKey: 'PROJ-1',
        status: 'done',
        sortOrder: 'c0',
        runState: null,
        runStateUpdatedAt: null,
        archivedAt: null,
        updatedAt: '2026-04-10T14:10:00.000Z',
        project: { id: 'project-1', name: 'Project A', projectKey: 'PROJ' },
      }),
    );
    expect(result.labels).toEqual([{ id: 'label-1', name: 'Frontend', color: 'emerald' }]);
  });
});
