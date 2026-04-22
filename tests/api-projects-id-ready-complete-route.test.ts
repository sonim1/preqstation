import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    requireOwnerUser: vi.fn(),
    assertSameOrigin: vi.fn(),
    writeAuditLog: vi.fn(),
    applyBoardTaskStatusTransition: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
        tasks: { findMany: vi.fn() },
      },
      transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/task-status-transition', () => ({
  applyBoardTaskStatusTransition: mocked.applyBoardTaskStatusTransition,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

import { POST } from '@/app/api/projects/[id]/ready/complete/route';

function postRequest() {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1/ready/complete`, {
    method: 'POST',
    headers: { origin: TEST_BASE_URL },
  });
}

describe('app/api/projects/[id]/ready/complete/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.applyBoardTaskStatusTransition.mockImplementation(
      async ({ existingTask, nextTask, now }) => ({
        ...existingTask,
        ...nextTask,
        runState: null,
        runStateUpdatedAt: null,
        updatedAt: now.toISOString(),
        archivedAt: null,
      }),
    );
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'Project A',
      projectKey: 'PROJ',
    });
    mocked.db.query.tasks.findMany
      .mockResolvedValueOnce([
        {
          id: 'task-1',
          taskKey: 'PROJ-1',
          branch: null,
          title: 'Ready 1',
          note: null,
          status: 'ready',
          sortOrder: 'a1',
          taskPriority: 'none',
          dueAt: null,
          engine: 'codex',
          runState: null,
          runStateUpdatedAt: null,
          archivedAt: null,
          updatedAt: new Date('2026-04-10T10:00:00.000Z'),
          projectId: 'project-1',
          labelId: null,
          project: { id: 'project-1', name: 'Project A', projectKey: 'PROJ' },
          labels: [],
        },
        {
          id: 'task-2',
          taskKey: 'PROJ-2',
          branch: null,
          title: 'Ready 2',
          note: null,
          status: 'ready',
          sortOrder: 'a2',
          taskPriority: 'none',
          dueAt: null,
          engine: null,
          runState: null,
          runStateUpdatedAt: null,
          archivedAt: null,
          updatedAt: new Date('2026-04-10T10:00:00.000Z'),
          projectId: 'project-1',
          labelId: null,
          project: { id: 'project-1', name: 'Project A', projectKey: 'PROJ' },
          labels: [],
        },
      ])
      .mockResolvedValueOnce([
        { id: 'done-1', sortOrder: 'a0' },
        { id: 'done-2', sortOrder: 'a1' },
      ]);
    mocked.db.transaction.mockImplementation(async (fn: Function) => {
      return fn({});
    });
  });

  it('moves ready tasks to done in ready order and returns moved tasks', async () => {
    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      movedCount: 2,
      movedTasks: [
        expect.objectContaining({
          taskKey: 'PROJ-1',
          status: 'done',
        }),
        expect.objectContaining({
          taskKey: 'PROJ-2',
          status: 'done',
        }),
      ],
    });
    expect(mocked.applyBoardTaskStatusTransition).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ownerId: 'owner-1',
        projectId: 'project-1',
        existingTask: expect.objectContaining({ taskKey: 'PROJ-1' }),
        nextTask: expect.objectContaining({
          status: 'done',
          sortOrder: expect.any(String),
        }),
      }),
    );
    expect(mocked.applyBoardTaskStatusTransition).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        existingTask: expect.objectContaining({ taskKey: 'PROJ-2' }),
        nextTask: expect.objectContaining({
          status: 'done',
          sortOrder: expect.any(String),
        }),
      }),
    );
    const firstSortOrder =
      mocked.applyBoardTaskStatusTransition.mock.calls[0]?.[0]?.nextTask?.sortOrder ?? '';
    const secondSortOrder =
      mocked.applyBoardTaskStatusTransition.mock.calls[1]?.[0]?.nextTask?.sortOrder ?? '';
    expect(firstSortOrder > 'a1').toBe(true);
    expect(secondSortOrder > firstSortOrder).toBe(true);
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'task.batch_completed',
        targetType: 'project',
        targetId: 'project-1',
        meta: expect.objectContaining({ count: 2, projectKey: 'PROJ' }),
      }),
      expect.anything(),
    );
  });

  it('returns 404 when the project does not exist', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 when the project has no ready tasks', async () => {
    mocked.db.query.tasks.findMany.mockReset();
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([]);

    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'No ready tasks available' });
    expect(mocked.writeAuditLog).not.toHaveBeenCalled();
  });
});
