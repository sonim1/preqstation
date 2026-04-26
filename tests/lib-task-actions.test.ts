import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskLabelAssignments } from '@/lib/db/schema';
import { buildTaskNoteFingerprint } from '@/lib/task-note-fingerprint';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });

  const tx = {
    insert: vi.fn().mockReturnValue({ values: valuesFn }),
    update: vi.fn().mockReturnValue({ set: setFn }),
    delete: vi.fn().mockReturnValue({ where: whereFn }),
    query: {
      workLogs: { findFirst: vi.fn() },
    },
  };

  const db = {
    query: {
      projects: { findFirst: vi.fn() },
      taskLabels: { findFirst: vi.fn(), findMany: vi.fn() },
      tasks: { findFirst: vi.fn() },
      userSettings: { findFirst: vi.fn() },
    },
    transaction: vi.fn(),
  };

  return {
    tx,
    txReturningFn: returningFn,
    txWhereFn: whereFn,
    txSetFn: setFn,
    txValuesFn: valuesFn,
    db,
    resolveAppendSortOrder: vi.fn(),
    writeOutboxEvent: vi.fn(),
    createTaskCompletionNotification: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: typeof mocked.tx) =>
      callback(
        Object.assign(tx, {
          query: {
            ...mocked.db.query,
            ...tx.query,
          },
        }),
      ),
    ),
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_TASK: 'task',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_DELETED: 'TASK_DELETED',
  writeOutboxEvent: mocked.writeOutboxEvent,
}));

vi.mock('@/lib/task-sort-order', () => ({
  resolveAppendSortOrder: mocked.resolveAppendSortOrder,
}));

vi.mock('@/lib/task-notifications', () => ({
  createTaskCompletionNotification: mocked.createTaskCompletionNotification,
}));

import { createTask, deleteTask, updateTask, updateTaskStatus } from '@/lib/actions/task-actions';
import { parseTaskNoteChangeDetail } from '@/lib/task-worklog';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID_2 = '66666666-6666-4666-8666-666666666666';
const LABEL_ID = '33333333-3333-4333-8333-333333333333';
const LABEL_ID_2 = '44444444-4444-4444-8444-444444444444';
const LABEL_ID_3 = '55555555-5555-4555-8555-555555555555';

describe('lib/actions/task-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.query.projects.findFirst.mockReset();
    mocked.db.query.taskLabels.findFirst.mockReset();
    mocked.db.query.taskLabels.findMany.mockReset();
    mocked.db.query.tasks.findFirst.mockReset();
    mocked.db.query.userSettings.findFirst.mockReset();
    mocked.txReturningFn.mockReset();
    mocked.tx.query.workLogs.findFirst.mockReset();
    mocked.resolveAppendSortOrder.mockReset();
    mocked.writeOutboxEvent.mockReset();
    mocked.db.transaction.mockReset();
    mocked.db.transaction.mockImplementation(
      async (callback: (tx: typeof mocked.tx) => Promise<unknown>) => callback(mocked.tx),
    );
    mocked.db.query.projects.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findMany.mockResolvedValue([]);
    mocked.db.query.tasks.findFirst.mockResolvedValue(null);
    mocked.db.query.userSettings.findFirst.mockResolvedValue(null);
    mocked.resolveAppendSortOrder.mockResolvedValue('a1');
    mocked.txReturningFn.mockResolvedValue([]);
    mocked.tx.query.workLogs.findFirst.mockResolvedValue(null);
    mocked.writeOutboxEvent.mockResolvedValue(undefined);
    mocked.createTaskCompletionNotification.mockResolvedValue(null);
  });

  it('createTask records TASK_CREATED outbox event inside the transaction', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: PROJECT_ID, projectKey: 'PROJ' });
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({ taskNumber: 7 })
      .mockResolvedValueOnce({ sortOrder: 'a0' });
    mocked.txReturningFn.mockResolvedValue([
      {
        id: 'task-1',
        taskKey: 'PROJ-8',
        projectId: PROJECT_ID,
        labelId: null,
        taskPriority: 'none',
      },
    ]);

    const result = await createTask({
      ownerId: OWNER_ID,
      title: 'Create from dashboard',
      contentMd: '',
      projectId: PROJECT_ID,
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.tx.insert).toHaveBeenCalledTimes(1);
    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKey: 'PROJ-8',
        title: 'Create from dashboard',
        branch: 'task/proj-8/create-from-dashboard',
        sortOrder: 'a1',
      }),
    );
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_CREATED',
        entityId: 'PROJ-8',
      }),
    );
  });

  it('createTask strips preq-choice blocks before persisting the note body', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: PROJECT_ID, projectKey: 'PROJ' });
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({ taskNumber: 7 })
      .mockResolvedValueOnce({ sortOrder: 'a0' });
    mocked.txReturningFn.mockResolvedValue([
      {
        id: 'task-1',
        taskKey: 'PROJ-8',
        projectId: PROJECT_ID,
        labelId: null,
        taskPriority: 'none',
      },
    ]);

    await createTask({
      ownerId: OWNER_ID,
      title: 'Create from dashboard',
      contentMd: [
        'Intro',
        '',
        ':::preq-choice',
        'Which engine should handle this task?',
        '- [ ] Codex',
        '- [x] Claude',
        ':::',
        '',
        'Outro',
      ].join('\n'),
      projectId: PROJECT_ID,
      taskPriority: 'none',
    });

    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Intro\n\nOutro',
      }),
    );
  });

  it('createTask syncs multiple label assignments in order', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: PROJECT_ID, projectKey: 'PROJ' });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: LABEL_ID, name: 'Bug' },
      { id: LABEL_ID_2, name: 'Frontend' },
    ]);
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({ taskNumber: 7 })
      .mockResolvedValueOnce({ sortOrder: 'a0' });
    mocked.txReturningFn.mockResolvedValue([
      {
        id: 'task-1',
        taskKey: 'PROJ-8',
        projectId: PROJECT_ID,
        labelId: LABEL_ID,
        taskPriority: 'none',
      },
    ]);

    const result = await createTask({
      ownerId: OWNER_ID,
      title: 'Create from dashboard',
      contentMd: '',
      projectId: PROJECT_ID,
      taskPriority: 'none',
      labelIds: [LABEL_ID, LABEL_ID_2],
    } as never);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
      }),
    });
    expect(mocked.tx.insert).toHaveBeenNthCalledWith(2, taskLabelAssignments);
    expect(mocked.txValuesFn).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'task-1', labelId: LABEL_ID, position: 0 }),
        expect.objectContaining({ taskId: 'task-1', labelId: LABEL_ID_2, position: 1 }),
      ]),
    );
  });

  it('createTask uses resolveAppendSortOrder for inbox inserts', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: PROJECT_ID, projectKey: 'PROJ' });
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({ taskNumber: 7 });
    mocked.resolveAppendSortOrder.mockResolvedValueOnce('z0');
    mocked.txReturningFn.mockResolvedValue([
      {
        id: 'task-1',
        taskKey: 'PROJ-8',
        projectId: PROJECT_ID,
        labelId: null,
        taskPriority: 'none',
      },
    ]);

    const result = await createTask({
      ownerId: OWNER_ID,
      title: 'Create from dashboard',
      contentMd: '',
      projectId: PROJECT_ID,
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
      }),
    });
    expect(mocked.resolveAppendSortOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.anything(),
        ownerId: OWNER_ID,
        status: 'inbox',
      }),
    );
    expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 'z0' }));
  });

  it('createTask rejects the request when any submitted label is missing', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: PROJECT_ID, projectKey: 'PROJ' });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([{ id: LABEL_ID, name: 'Bug' }]);

    const result = await createTask({
      ownerId: OWNER_ID,
      title: 'Create from dashboard',
      contentMd: '',
      projectId: PROJECT_ID,
      taskPriority: 'none',
      labelIds: [LABEL_ID, LABEL_ID_2],
    } as never);

    expect(result).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: expect.stringContaining('label'),
    });
  });

  it('updateTask records TASK_UPDATED outbox and work log inside one transaction', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Before',
      note: null,
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: LABEL_ID, name: 'Urgent', color: 'red' },
    ]);

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'After',
      noteMd: 'updated note',
      labelIds: [LABEL_ID],
      taskPriority: 'high',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.tx.update).toHaveBeenCalledTimes(1);
    expect(mocked.tx.insert).toHaveBeenCalledTimes(3);
    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'PROJ-8 · Note Updated',
      }),
    );
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_UPDATED',
        entityId: 'PROJ-8',
        payload: expect.objectContaining({
          changedFields: expect.arrayContaining(['Title', 'Task Priority', 'Labels', 'Note']),
        }),
      }),
    );
  });

  it('updateTask replaces task labels and records joined label names', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Before',
      note: null,
      projectId: PROJECT_ID,
      labelId: LABEL_ID,
      taskPriority: 'none',
      label: { name: 'Bug' },
      labels: [{ id: LABEL_ID, name: 'Bug', color: 'red' }],
    });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([
      { id: LABEL_ID_2, name: 'Feature' },
      { id: LABEL_ID_3, name: 'Frontend' },
    ]);

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'After',
      noteMd: '',
      taskPriority: 'none',
      labelIds: [LABEL_ID_2, LABEL_ID_3],
    } as never);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
      }),
    });
    expect(mocked.tx.delete).toHaveBeenCalled();
    expect(mocked.tx.insert).toHaveBeenCalledWith(taskLabelAssignments);
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_UPDATED',
        entityId: 'PROJ-8',
        payload: expect.objectContaining({
          changedFields: expect.arrayContaining(['Title', 'Labels']),
        }),
      }),
    );
  });

  it('updateTask clears all label assignments when an empty labelIds array is submitted', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: null,
      projectId: PROJECT_ID,
      labelId: LABEL_ID,
      taskPriority: 'none',
      label: { name: 'Bug' },
      labels: [{ id: LABEL_ID, name: 'Bug', color: 'red' }],
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: '',
      taskPriority: 'none',
      labelIds: [],
    } as never);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
      }),
    });
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId: null,
      }),
    );
    expect(mocked.tx.delete).toHaveBeenCalled();
    expect(mocked.tx.insert.mock.calls.some(([table]) => table === taskLabelAssignments)).toBe(
      false,
    );
  });

  it('updateTask rejects label ids that are not available on the task project', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Before',
      note: null,
      projectId: PROJECT_ID,
      labelId: LABEL_ID,
      taskPriority: 'none',
      label: { name: 'Bug' },
      labels: [{ id: LABEL_ID, name: 'Bug', color: 'red' }],
    });
    mocked.db.query.taskLabels.findMany.mockResolvedValue([{ id: LABEL_ID_2, name: 'Feature' }]);

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Before',
      noteMd: '',
      taskPriority: 'none',
      labelIds: [LABEL_ID_2, LABEL_ID_3],
    } as never);

    expect(result).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'One or more labels not found.',
    });
    expect(mocked.tx.update).not.toHaveBeenCalled();
  });

  it('updateTask keeps the project filter immutable when a different project context is supplied', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue(null);

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'After',
      noteMd: '',
      taskPriority: 'none',
      projectId: PROJECT_ID_2,
    });

    expect(result).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Task not found.',
    });
    expect(mocked.tx.update).not.toHaveBeenCalled();
  });

  it('updateTask skips transaction/outbox when no field changes exist', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: 'same',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: 'same',
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: false,
        changedFields: [],
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.tx.update).not.toHaveBeenCalled();
    expect(mocked.tx.insert).not.toHaveBeenCalled();
    expect(mocked.writeOutboxEvent).not.toHaveBeenCalled();
  });

  it('updateTask clears task engine when a human edits task content', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Before',
      note: null,
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      engine: 'codex',
      label: null,
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'After',
      noteMd: '',
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
        changedFields: ['Title'],
      }),
    });
    expect(mocked.txSetFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
    expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
  });

  it('updateTask persists non-empty note edits when only note text changes', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: 'existing note body',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: 'updated note body',
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
        changedFields: ['Note'],
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'updated note body',
      }),
    );
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_UPDATED',
        entityId: 'PROJ-8',
        payload: expect.objectContaining({
          changedFields: ['Note'],
        }),
      }),
    );
  });

  it('updateTask rejects stale note edits when the server note changed in another session', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: 'latest server note',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: 'local stale rewrite',
      baseNoteFingerprint: buildTaskNoteFingerprint('older note'),
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Task notes changed in another session. Reload the latest notes and try again.',
    });
    expect(mocked.tx.update).not.toHaveBeenCalled();
  });

  it('updateTask preserves the latest server note when only non-note fields changed from a stale form', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Before',
      note: 'latest server note',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'After',
      noteMd: 'older note',
      baseNoteFingerprint: buildTaskNoteFingerprint('older note'),
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
        changedFields: ['Title'],
      }),
    });
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'After',
        note: 'latest server note',
      }),
    );
  });

  it('updateTask strips preq-choice blocks before persisting note edits', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: 'existing note body',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
    });

    await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: [
        'Before',
        '',
        ':::preq-choice',
        'Which engine should handle this task?',
        '- [ ] Codex',
        '- [x] Claude',
        ':::',
        '',
        'After',
      ].join('\n'),
      taskPriority: 'none',
    });

    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Before\n\nAfter',
      }),
    );
  });

  it('updateTask writes a note change work log when only the note body changed', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: 'existing note body',
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      label: null,
      engine: 'codex',
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: 'updated note body',
      taskPriority: 'none',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
        changedFields: ['Note'],
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.txValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'PROJ-8 · Note Updated',
      }),
    );
    const noteLogCall = mocked.txValuesFn.mock.calls.find(
      ([value]) => value.title === 'PROJ-8 · Note Updated',
    );
    expect(noteLogCall).toBeTruthy();
    expect(parseTaskNoteChangeDetail(noteLogCall![0].detail)).toMatchObject({
      taskKey: 'PROJ-8',
      taskTitle: 'Same title',
      previousNote: 'existing note body',
      updatedNote: 'updated note body',
    });
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_UPDATED',
        entityId: 'PROJ-8',
        payload: expect.objectContaining({
          changedFields: ['Note'],
        }),
      }),
    );
  });

  it('updateTask persists run state changes with a fresh timestamp', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Same title',
      note: null,
      projectId: PROJECT_ID,
      labelId: null,
      taskPriority: 'none',
      runState: null,
      label: null,
      engine: 'codex',
    });

    const result = await updateTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      title: 'Same title',
      noteMd: '',
      taskPriority: 'none',
      runState: 'queued',
    } as never);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        changed: true,
        changedFields: ['Run State'],
      }),
    });
    expect(mocked.txSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        runState: 'queued',
        runStateUpdatedAt: expect.any(Date),
      }),
    );
    expect(mocked.txSetFn.mock.calls.at(-1)?.[0]).not.toMatchObject({ engine: null });
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_UPDATED',
        entityId: 'PROJ-8',
        payload: expect.objectContaining({
          changedFields: ['Run State'],
        }),
      }),
    );
  });

  it('updateTaskStatus records TASK_STATUS_CHANGED outbox and status work log in one transaction', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Move me',
      status: 'todo',
      projectId: PROJECT_ID,
    });

    const result = await updateTaskStatus({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      status: 'hold',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        fromStatus: 'todo',
        status: 'hold',
        changed: true,
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.tx.update).toHaveBeenCalledTimes(1);
    expect(mocked.tx.insert).toHaveBeenCalledTimes(1);
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_STATUS_CHANGED',
        entityId: 'PROJ-8',
      }),
    );
  });

  it('updateTaskStatus creates a notification when running work moves into done', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Move me',
      status: 'todo',
      projectId: PROJECT_ID,
      runState: 'running',
    });

    await updateTaskStatus({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      status: 'done',
    });

    expect(mocked.createTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        taskId: 'task-1',
        taskKey: 'PROJ-8',
        taskTitle: 'Move me',
        fromStatus: 'todo',
        toStatus: 'done',
        previousRunState: 'running',
      }),
    );
  });

  it('updateTaskStatus enforces provided project scope in lookup', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Scoped',
      status: 'todo',
      projectId: PROJECT_ID,
    });

    await updateTaskStatus({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      status: 'done',
      projectId: PROJECT_ID,
    });

    expect(mocked.db.query.tasks.findFirst).toHaveBeenCalled();
  });

  it('updateTaskStatus clears task engine for manual status moves', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      title: 'Move me',
      status: 'todo',
      projectId: PROJECT_ID,
      engine: 'gemini-cli',
    });

    const result = await updateTaskStatus({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      status: 'hold',
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
        fromStatus: 'todo',
        status: 'hold',
        changed: true,
      }),
    });
    expect(mocked.txSetFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
    expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
  });

  it('deleteTask records TASK_DELETED outbox event inside transaction', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      projectId: PROJECT_ID,
    });

    const result = await deleteTask({
      ownerId: OWNER_ID,
      identifier: 'PROJ-8',
      projectId: PROJECT_ID,
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        taskKey: 'PROJ-8',
      }),
    });
    expect(mocked.db.transaction).toHaveBeenCalledTimes(1);
    expect(mocked.tx.delete).toHaveBeenCalledTimes(1);
    expect(mocked.writeOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: mocked.tx,
        eventType: 'TASK_DELETED',
        entityId: 'PROJ-8',
      }),
    );
  });
});
