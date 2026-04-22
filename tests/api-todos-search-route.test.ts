import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  searchTasksForBoard: vi.fn(),
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

vi.mock('@/lib/task-search', () => ({
  searchTasksForBoard: mocked.searchTasksForBoard,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { GET } from '@/app/api/todos/search/route';

function request(url: string) {
  return new Request(url, { method: 'GET' });
}

describe('app/api/todos/search/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.searchTasksForBoard.mockResolvedValue([]);
    mocked.db.query.tasks.findMany.mockResolvedValue([]);
  });

  it('returns the owner auth error unchanged', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    const response = await GET(request(`${TEST_BASE_URL}/api/todos/search?q=login`));

    expect(response.status).toBe(401);
    expect(mocked.searchTasksForBoard).not.toHaveBeenCalled();
  });

  it('returns empty grouped columns for a blank query', async () => {
    const response = await GET(request(`${TEST_BASE_URL}/api/todos/search?q=%20%20`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      query: '',
      total: 0,
      results: [],
    });
    expect(mocked.searchTasksForBoard).not.toHaveBeenCalled();
    expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
  });

  it('passes project scope into task search', async () => {
    mocked.searchTasksForBoard.mockResolvedValueOnce([{ taskId: 'task-1', score: 11 }]);
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      {
        id: 'task-1',
        taskKey: 'PROJ-12',
        title: 'Deploy pipeline fix',
        status: 'todo',
        project: {
          id: 'project-1',
          name: 'Alpha',
          projectKey: 'ALPHA',
        },
      },
    ]);

    const response = await GET(
      request(
        `${TEST_BASE_URL}/api/todos/search?q=%EB%A1%9C%EA%B7%B8%EC%9D%B8&projectId=project-1`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocked.searchTasksForBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        query: '로그인',
        projectId: 'project-1',
        client: expect.anything(),
      }),
    );
    expect(body).toEqual({
      query: '로그인',
      total: 1,
      results: [
        {
          taskId: 'task-1',
          taskKey: 'PROJ-12',
          title: 'Deploy pipeline fix',
          status: 'todo',
          project: {
            id: 'project-1',
            name: 'Alpha',
            projectKey: 'ALPHA',
          },
        },
      ],
    });
  });

  it('preserves search order in the flat results payload', async () => {
    mocked.searchTasksForBoard.mockResolvedValueOnce([
      { taskId: 'task-2', score: 9.5 },
      { taskId: 'task-1', score: 8.75 },
      { taskId: 'task-3', score: 7.25 },
    ]);
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      {
        id: 'task-1',
        taskKey: 'PROJ-12',
        title: 'Deploy pipeline fix',
        status: 'todo',
        project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
      },
      {
        id: 'task-3',
        taskKey: 'PROJ-77',
        title: 'Archive stale QA run',
        status: 'done',
        project: null,
      },
      {
        id: 'task-2',
        taskKey: 'PROJ-42',
        title: 'Deploy smoke tests',
        status: 'ready',
        project: { id: 'project-2', name: 'Beta', projectKey: 'BETA' },
      },
    ]);

    const response = await GET(request(`${TEST_BASE_URL}/api/todos/search?q=deploy`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([
      {
        taskId: 'task-2',
        taskKey: 'PROJ-42',
        title: 'Deploy smoke tests',
        status: 'ready',
        project: { id: 'project-2', name: 'Beta', projectKey: 'BETA' },
      },
      {
        taskId: 'task-1',
        taskKey: 'PROJ-12',
        title: 'Deploy pipeline fix',
        status: 'todo',
        project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
      },
      {
        taskId: 'task-3',
        taskKey: 'PROJ-77',
        title: 'Archive stale QA run',
        status: 'done',
        project: null,
      },
    ]);
  });
});
