import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
  const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txWhereFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txSetFn = vi.fn().mockReturnValue({ where: txWhereFn });
  const txValuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txDeleteWhereFn = vi.fn();
  const txDelete = vi.fn().mockReturnValue({ where: txDeleteWhereFn });
  const txInsert = vi.fn().mockReturnValue({ values: txValuesFn });
  const txUpdate = vi.fn().mockReturnValue({ set: txSetFn });

  return {
    authenticateApiToken: vi.fn(),
    writeAuditLog: vi.fn(),
    safeCreateTaskCompletionNotification: vi.fn(),
    db: {
      query: {
        tasks: { findFirst: vi.fn() },
        projects: { findFirst: vi.fn() },
        taskLabels: { findFirst: vi.fn(), findMany: vi.fn() },
        workLogs: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: setFn }),
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
      delete: vi.fn().mockReturnValue({ where: whereFn }),
      transaction: vi.fn(),
    },
    returningFn,
    whereFn,
    setFn,
    valuesFn,
    txWhereFn,
    txSetFn,
    txValuesFn,
    txDeleteWhereFn,
    txDelete,
    txInsert,
    txUpdate,
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async () => callback(mocked.db)),
}));

vi.mock('@/lib/task-notifications', () => ({
  safeCreateTaskCompletionNotification: mocked.safeCreateTaskCompletionNotification,
}));

import { GET, PATCH } from '@/app/api/tasks/[id]/route';
import { parseTaskNoteChangeDetail } from '@/lib/task-worklog';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/tasks/NONE-1`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function getRequest() {
  return new Request(`${TEST_BASE_URL}/api/tasks/NONE-1`, {
    method: 'GET',
  });
}

describe('app/api/tasks/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQSTATION Token',
    });
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.safeCreateTaskCompletionNotification.mockResolvedValue(null);
    mocked.db.query.tasks.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskKey: 'NONE-1',
      taskPrefix: 'NONE',
      taskNumber: 1,
      title: 'Task A',
      note: null,
      status: 'inbox',
      taskPriority: 'none',
      engine: 'codex',
      projectId: null,
      project: null,
      label: null,
    });
    mocked.returningFn.mockResolvedValue([{ id: 'log-1' }]);
    mocked.db.update.mockReturnValue({ set: mocked.setFn });
    mocked.setFn.mockReturnValue({ where: mocked.whereFn });
    mocked.whereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.db.insert.mockReturnValue({ values: mocked.valuesFn });
    mocked.valuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txUpdate.mockReturnValue({ set: mocked.txSetFn });
    mocked.txSetFn.mockReturnValue({ where: mocked.txWhereFn });
    mocked.txWhereFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txInsert.mockReturnValue({ values: mocked.txValuesFn });
    mocked.txValuesFn.mockReturnValue({ returning: mocked.returningFn });
    mocked.txDelete.mockReturnValue({ where: mocked.txDeleteWhereFn });
    mocked.db.query.projects.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findMany.mockResolvedValue([]);
    mocked.db.query.workLogs.findFirst.mockResolvedValue(null);
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      const tx = {
        delete: mocked.txDelete,
        insert: mocked.txInsert,
        update: mocked.txUpdate,
      };
      return fn(tx);
    });
  });

  it('PATCH rejects task identity updates', async () => {
    const response = await PATCH(
      patchRequest({
        taskKey: 'TEST-99',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Task ID is auto-generated and cannot be edited.',
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('GET returns every assigned label in the task payload', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'NONE-1',
      taskPrefix: 'NONE',
      taskNumber: 1,
      title: 'Task A',
      note: null,
      status: 'todo',
      taskPriority: 'none',
      engine: 'codex',
      createdAt: new Date('2026-02-18T00:00:00.000Z'),
      updatedAt: new Date('2026-02-18T00:00:00.000Z'),
      projectId: null,
      project: null,
      label: null,
      labelAssignments: [
        { position: 0, label: { id: 'label-bug', name: 'bug', color: 'red' } },
        { position: 1, label: { id: 'label-frontend', name: 'frontend', color: '#228be6' } },
      ],
    });

    const response = await GET(getRequest(), {
      params: Promise.resolve({ id: 'NONE-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        task: expect.objectContaining({
          labels: ['bug', 'frontend'],
        }),
      }),
    );
  });

  it('GET returns latest PREQ result metadata when a result work log exists', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'PROJ-222',
      taskPrefix: 'PROJ',
      taskNumber: 222,
      title: 'Mobile issue',
      note: null,
      status: 'hold',
      taskPriority: 'none',
      engine: 'codex',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z'),
      projectId: null,
      project: null,
      label: null,
      labelAssignments: [],
    });
    mocked.db.query.workLogs.findFirst.mockResolvedValueOnce({
      title: 'PREQSTATION Result · Mobile issue',
      detail: [
        '**PROJ-222** · Mobile issue',
        '',
        'Keep the mobile empty panel stretched.',
        '',
        '**Blocked reason:** Swipe wrapper is outside the flex-height chain.',
        '',
        '---',
        '',
        'Blocked: 2026-03-14T10:00:00.000Z · Source: PREQSTATION Token',
      ].join('\n'),
      workedAt: new Date('2026-03-14T10:00:00.000Z'),
      createdAt: new Date('2026-03-14T10:00:00.000Z'),
    });

    const response = await GET(getRequest(), {
      params: Promise.resolve({ id: 'PROJ-222' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        task: expect.objectContaining({
          latest_preq_result: {
            title: 'PREQSTATION Result · Mobile issue',
            summary: 'Keep the mobile empty panel stretched.',
            blocked_reason: 'Swipe wrapper is outside the flex-height chain.',
            worked_at: '2026-03-14T10:00:00.000Z',
          },
        }),
      }),
    );
  });

  it('PATCH updates non-identity fields', async () => {
    // After db.update, source re-fetches the updated task
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A updated',
        note: 'Updated',
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        title: 'Task A updated',
        description: 'Updated',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.db.update).toHaveBeenCalled();
    expect(mocked.db.insert).toHaveBeenCalled();
  });

  it('PATCH accepts raw note replacement without rebuilding description fields', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Context\n\nBefore',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Context\n\nAfter',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        noteMarkdown: '## Context\n\nAfter',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: '## Context\n\nAfter',
      }),
    );
  });

  it('PATCH writes note history when only the deeper note body changes', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Context\n\nOld details',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Context\n\nNew details',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        description: '## Context\n\nNew details',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    const noteLogCall = mocked.valuesFn.mock.calls.find(
      ([value]) => value.title === 'NONE-1 · Note Updated',
    );
    expect(noteLogCall).toBeTruthy();
    const detail = noteLogCall![0].detail as string;
    expect(detail).not.toContain('**Previous Note**');
    expect(parseTaskNoteChangeDetail(detail)).toMatchObject({
      taskKey: 'NONE-1',
      taskTitle: 'Task A',
      previousNote: '## Context\n\nOld details',
      updatedNote: '## Context\n\nNew details',
    });
  });

  it('PATCH writes status-change work log when a task moves from inbox to todo', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-02-18T00:05:00.000Z'),
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'todo',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        title: expect.stringContaining('Inbox -> Planned'),
      }),
    );
  });

  it('PATCH status todo moves inbox card to todo', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'todo',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'todo',
      }),
    );
  });

  it('PATCH lifecycle_action start marks task execution as running without changing workflow status', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        runState: 'queued',
        runStateUpdatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'gemini-cli',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-02-18T00:05:00.000Z'),
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'start',
        engine: 'gemini-cli',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: 'gemini-cli',
        runState: 'running',
      }),
    );
    expect(body.task.status).toBe('todo');
    expect(body.task.run_state).toBe('working');
  });

  it('PATCH lifecycle_action plan promotes inbox task to todo', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Plan body',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'plan',
        planMarkdown: 'Plan body',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Plan body',
        status: 'todo',
      }),
    );
    expect(body.task.status).toBe('todo');
  });

  it('PATCH lifecycle_action plan updates todo task without rejecting or changing status', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Plan body',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'plan',
        planMarkdown: 'Plan body',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Plan body',
      }),
    );
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.not.objectContaining({
        status: expect.anything(),
      }),
    );
    expect(body.task.status).toBe('todo');
  });

  it('PATCH status done moves ready card to done', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'ready',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'done',
        taskPriority: 'none',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'done',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
      }),
    );
  });

  it('PATCH lifecycle_action complete moves todo task to ready and clears run state', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Completed',
        status: 'ready',
        taskPriority: 'none',
        engine: 'codex',
        runState: null,
        runStateUpdatedAt: null,
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'complete',
        engine: 'codex',
        result: {
          summary: 'Done',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        runState: null,
      }),
    );
    expect(mocked.safeCreateTaskCompletionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'todo-1',
        taskKey: 'NONE-1',
        taskTitle: 'Task A',
        fromStatus: 'todo',
        toStatus: 'ready',
        previousRunState: 'running',
        nextRunState: null,
        lifecycleAction: 'complete',
      }),
    );
    expect(body.task.status).toBe('ready');
    expect(body.task.run_state).toBeNull();
  });

  it('PATCH lifecycle_action complete accepts branch, tests, notes, and completed_at from MCP', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'PROJ-337',
        taskPrefix: 'PROJ',
        taskNumber: 337,
        title: 'Investigate this issue',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        branch: null,
        runState: 'running',
        runStateUpdatedAt: new Date('2026-04-08T14:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'PROJ-337',
        taskPrefix: 'PROJ',
        taskNumber: 337,
        title: 'Investigate this issue',
        note: 'Completed',
        status: 'ready',
        taskPriority: 'none',
        engine: 'codex',
        branch: 'task/proj-337/investigate-this-issue',
        runState: null,
        runStateUpdatedAt: null,
        createdAt: new Date('2026-04-08T14:00:00.000Z'),
        updatedAt: new Date('2026-04-08T14:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'complete',
        engine: 'codex',
        branch: 'task/proj-337/investigate-this-issue',
        result: {
          summary: 'Done',
          tests: 'npm run typecheck && npm run test:unit',
          notes: 'Committed directly to origin/main',
          completed_at: '2026-04-08T14:05:00.000Z',
        },
      }),
      { params: Promise.resolve({ id: 'PROJ-337' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        runState: null,
        branch: 'task/proj-337/investigate-this-issue',
      }),
    );
    const resultLogInsert = mocked.valuesFn.mock.calls
      .map(([payload]) => payload)
      .find(
        (payload) =>
          payload &&
          typeof payload === 'object' &&
          'title' in payload &&
          typeof payload.title === 'string' &&
          payload.title.includes('PREQSTATION Result'),
      );
    expect(resultLogInsert).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Result'),
        engine: 'codex',
        detail: expect.stringContaining('**Tests:** npm run typecheck && npm run test:unit'),
      }),
    );
    expect(resultLogInsert).toEqual(
      expect.objectContaining({
        detail: expect.stringContaining('**Notes:** Committed directly to origin/main'),
      }),
    );
    expect(resultLogInsert).toEqual(
      expect.objectContaining({
        detail: expect.stringContaining('Completed: 2026-04-08T14:05:00.000Z'),
      }),
    );
    expect(body.task).toEqual(
      expect.objectContaining({
        status: 'ready',
        branch: 'task/proj-337/investigate-this-issue',
      }),
    );
  });

  it('PATCH lifecycle_action complete blocks ready transition when auto PR projects are missing branch or pr_url', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'PROJ-401',
      taskPrefix: 'PROJ',
      taskNumber: 401,
      title: 'Require PR before ready',
      note: null,
      status: 'todo',
      taskPriority: 'none',
      engine: 'codex',
      branch: null,
      runState: 'running',
      runStateUpdatedAt: new Date('2026-04-08T14:00:00.000Z'),
      projectId: 'project-1',
      project: {
        repoUrl: 'https://github.com/acme/app',
        projectSettings: [
          { key: 'deploy_strategy', value: 'feature_branch' },
          { key: 'deploy_default_branch', value: 'main' },
          { key: 'deploy_auto_pr', value: 'true' },
          { key: 'deploy_commit_on_review', value: 'true' },
        ],
      },
      label: null,
    });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'complete',
        engine: 'codex',
        result: {
          summary: 'Done',
        },
      }),
      { params: Promise.resolve({ id: 'PROJ-401' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('feature_branch + auto_pr + commit_on_review');
    expect(body.error).toContain('feature branch name');
    expect(body.error).toContain('pull request URL');
    expect(mocked.setFn).not.toHaveBeenCalled();
    expect(mocked.valuesFn).not.toHaveBeenCalled();
  });

  it('PATCH status ready blocks direct ready transition when auto PR projects are missing branch or pr_url', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'PROJ-401',
      taskPrefix: 'PROJ',
      taskNumber: 401,
      title: 'Require PR before ready',
      note: null,
      status: 'todo',
      taskPriority: 'none',
      engine: 'codex',
      branch: null,
      runState: 'running',
      runStateUpdatedAt: new Date('2026-04-08T14:00:00.000Z'),
      projectId: 'project-1',
      project: {
        repoUrl: 'https://github.com/acme/app',
        projectSettings: [
          { key: 'deploy_strategy', value: 'feature_branch' },
          { key: 'deploy_default_branch', value: 'main' },
          { key: 'deploy_auto_pr', value: 'true' },
          { key: 'deploy_commit_on_review', value: 'true' },
        ],
      },
      label: null,
    });

    const response = await PATCH(
      patchRequest({
        status: 'ready',
      }),
      { params: Promise.resolve({ id: 'PROJ-401' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('feature_branch + auto_pr + commit_on_review');
    expect(body.error).toContain('feature branch name');
    expect(body.error).toContain('pull request URL');
    expect(mocked.setFn).not.toHaveBeenCalled();
    expect(mocked.valuesFn).not.toHaveBeenCalled();
  });
  it('PATCH lifecycle_action complete logs the underlying insert failure before returning 500', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'PROJ-337',
        taskPrefix: 'PROJ',
        taskNumber: 337,
        title: 'Investigate this issue',
        note: 'Existing task note',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        branch: 'task/proj-337/investigate-this-issue',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-04-08T14:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'PROJ-337',
        taskPrefix: 'PROJ',
        taskNumber: 337,
        title: 'Investigate this issue',
        note: 'Existing task note',
        status: 'ready',
        taskPriority: 'none',
        engine: 'codex',
        branch: 'task/proj-337/investigate-this-issue',
        runState: null,
        runStateUpdatedAt: null,
        createdAt: new Date('2026-04-08T14:00:00.000Z'),
        updatedAt: new Date('2026-04-08T14:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    mocked.valuesFn
      .mockReturnValueOnce({ returning: mocked.returningFn })
      .mockImplementationOnce(() => {
        throw new Error('time zone "Mars/Olympus" not recognized');
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'complete',
        engine: 'codex',
        branch: 'task/proj-337/investigate-this-issue',
        result: {
          summary: 'Done',
          tests: 'npm run test:unit passed',
          notes: 'Direct commit already landed on main',
          completed_at: '2026-04-08T14:05:00.000Z',
        },
      }),
      { params: Promise.resolve({ id: 'PROJ-337' }) },
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      '[tasks.patch] failed:',
      expect.objectContaining({
        taskId: 'PROJ-337',
        lifecycleAction: 'complete',
        hasResult: true,
        hasBranch: true,
      }),
      expect.any(Error),
    );
  });

  it('PATCH lifecycle_action review moves ready task to done and clears run state', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'ready',
        taskPriority: 'none',
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Verified',
        status: 'done',
        taskPriority: 'none',
        engine: 'codex',
        runState: null,
        runStateUpdatedAt: null,
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'review',
        engine: 'codex',
        result: {
          summary: 'All checks passed',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
        runState: null,
      }),
    );
    expect(body.task.status).toBe('done');
  });

  it('PATCH lifecycle_action block moves active task to hold and clears run state', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        runState: 'running',
        runStateUpdatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Blocked',
        status: 'hold',
        taskPriority: 'none',
        engine: 'codex',
        runState: null,
        runStateUpdatedAt: null,
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:05:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'block',
        engine: 'codex',
        result: {
          reason: 'Needs API key',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'hold',
        runState: null,
      }),
    );
    expect(body.task.status).toBe('hold');
  });

  it('PATCH hold moves task to hold and writes result log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Blocked by missing API scope',
        status: 'hold',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'hold',
        result: {
          reason: 'Missing API scope',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.db.update).toHaveBeenCalled();
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'hold',
      }),
    );
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Result'),
      }),
    );
  });

  it('PATCH returns every assigned label after updating labels', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        projectId: 'project-1',
        project: { repoUrl: 'https://github.com/acme/app', projectSettings: [] },
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: 'project-1',
        project: { repoUrl: 'https://github.com/acme/app', projectSettings: [] },
        label: null,
        labelAssignments: [
          { position: 0, label: { id: 'label-bug', name: 'bug', color: 'red' } },
          { position: 1, label: { id: 'label-frontend', name: 'frontend', color: '#228be6' } },
        ],
      });

    const response = await PATCH(
      patchRequest({
        labels: ['bug', 'frontend'],
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.db.transaction).toHaveBeenCalled();
    expect(await response.json()).toEqual(
      expect.objectContaining({
        task: expect.objectContaining({
          labels: ['bug', 'frontend'],
        }),
      }),
    );
  });

  it('PATCH rejects repo changes that would move a task to another project', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'NONE-1',
      taskPrefix: 'NONE',
      taskNumber: 1,
      title: 'Task A',
      note: null,
      status: 'todo',
      taskPriority: 'none',
      engine: 'codex',
      projectId: 'project-1',
      project: { repoUrl: 'https://github.com/acme/app', projectSettings: [] },
      label: null,
    });
    mocked.db.query.projects.findFirst.mockResolvedValueOnce({
      id: 'project-2',
      name: 'Other Project',
      projectKey: 'OTHR',
    });

    const response = await PATCH(
      patchRequest({
        repo: 'https://github.com/acme/other',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Project changes are not supported.' });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('GET returns available labels for the task project only', async () => {
    mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'todo-1',
      taskKey: 'NONE-1',
      taskPrefix: 'NONE',
      taskNumber: 1,
      title: 'Task A',
      note: null,
      status: 'todo',
      taskPriority: 'none',
      engine: 'codex',
      createdAt: new Date('2026-02-18T00:00:00.000Z'),
      updatedAt: new Date('2026-02-18T00:00:00.000Z'),
      projectId: 'project-1',
      project: { repoUrl: 'https://github.com/acme/app', projectSettings: [] },
      label: null,
      labelAssignments: [],
    });
    mocked.db.query.taskLabels.findMany.mockResolvedValueOnce([{ name: 'bug', color: 'red' }]);

    const response = await GET(getRequest(), {
      params: Promise.resolve({ id: 'NONE-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        available_labels: [{ name: 'bug', color: 'red' }],
      }),
    );
  });

  it('PATCH preq plan update writes PREQSTATION plan work log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Plan\n\n- [ ] verify work log behavior',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'todo',
        engine: 'codex',
        description: '## Plan\n\n- [ ] verify work log behavior',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Plan'),
        engine: 'codex',
      }),
    );
  });

  it('PATCH preq planMarkdown update writes PREQSTATION plan work log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Plan\n\n- [ ] verify work log behavior',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'todo',
        engine: 'codex',
        planMarkdown: '## Plan\n\n- [ ] verify work log behavior',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Plan'),
        engine: 'codex',
      }),
    );
  });

  it('PATCH lifecycle_action plan with description writes PREQSTATION plan work log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '## Plan\n\n- [ ] verify work log behavior',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        lifecycle_action: 'plan',
        engine: 'codex',
        description: '## Plan\n\n- [ ] verify work log behavior',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Plan'),
        engine: 'codex',
      }),
    );
  });

  it('PATCH treats plannedAt result payload as PREQSTATION plan work log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Plan created',
        status: 'todo',
        taskPriority: 'none',
        engine: 'gemini-cli',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'todo',
        engine: 'gemini-cli',
        result: {
          planned_at: '2026-03-03T12:48:00.000Z',
          summary: 'Plan drafted',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Plan'),
        engine: 'gemini-cli',
      }),
    );
  });

  it('PATCH stores engine on PREQSTATION result work log', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: 'Completed',
        status: 'ready',
        taskPriority: 'none',
        engine: 'gemini-cli',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        status: 'ready',
        engine: 'gemini-cli',
        result: {
          summary: 'Done',
        },
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Result'),
        engine: 'gemini-cli',
      }),
    );
  });

  it('PATCH with planMarkdown auto-promotes inbox task to todo', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '# Plan\n\nDo the thing.',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        planMarkdown: '# Plan\n\nDo the thing.',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'todo',
        note: expect.stringContaining('Do the thing.'),
      }),
    );
    expect(mocked.valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('PREQSTATION Plan'),
        engine: 'codex',
      }),
    );
  });

  it('PATCH updates branch field', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        branch: 'feature/custom-branch',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        branch: 'feature/custom-branch',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'feature/custom-branch',
      }),
    );
  });

  it('PATCH clears branch field when empty string is provided', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'inbox',
        taskPriority: 'none',
        engine: 'codex',
        branch: null,
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        branch: '',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: null,
      }),
    );
  });

  it('PATCH with planMarkdown does not change status when task is not inbox', async () => {
    mocked.db.query.tasks.findFirst
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: null,
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        projectId: null,
        project: null,
        label: null,
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        taskKey: 'NONE-1',
        taskPrefix: 'NONE',
        taskNumber: 1,
        title: 'Task A',
        note: '# Updated Plan',
        status: 'todo',
        taskPriority: 'none',
        engine: 'codex',
        createdAt: new Date('2026-02-18T00:00:00.000Z'),
        updatedAt: new Date('2026-02-18T00:00:00.000Z'),
        projectId: null,
        project: null,
        label: null,
      });

    const response = await PATCH(
      patchRequest({
        planMarkdown: '# Updated Plan',
      }),
      { params: Promise.resolve({ id: 'NONE-1' }) },
    );

    expect(response.status).toBe(200);
    // status should NOT be set in the update data when not inbox
    expect(mocked.setFn).toHaveBeenCalledWith(
      expect.not.objectContaining({
        status: expect.anything(),
      }),
    );
  });
});
