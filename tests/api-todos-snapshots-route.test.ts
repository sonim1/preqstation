import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  db: {
    query: {
      tasks: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { GET } from '@/app/api/todos/snapshots/route';

describe('app/api/todos/snapshots/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.db.query.tasks.findMany.mockResolvedValue([
      {
        id: 'task-1',
        taskKey: 'PROJ-255',
        branch: 'task/proj-255/justand-sayong',
        title: 'Task',
        note: null,
        status: 'todo',
        sortOrder: 'a0',
        taskPriority: 'none',
        dueAt: null,
        engine: null,
        runState: null,
        runStateUpdatedAt: null,
        archivedAt: null,
        updatedAt: new Date('2026-03-24T00:00:00.000Z'),
        project: { id: 'project-1', name: 'Project', projectKey: 'PROJ' },
        label: null,
        labelAssignments: [],
      },
    ]);
  });

  it('returns lightweight card snapshots for requested task keys', async () => {
    const response = await GET(
      new Request(`${TEST_BASE_URL}/api/todos/snapshots?taskKey=PROJ-255`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tasks: [
        expect.objectContaining({
          taskKey: 'PROJ-255',
          title: 'Task',
          status: 'todo',
        }),
      ],
    });
    expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
  });
});
