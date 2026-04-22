import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  db: {
    execute: vi.fn(),
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

import { GET } from '@/app/api/todos/archived/route';

function request(url: string) {
  return new Request(url, { method: 'GET' });
}

function flattenQueryChunks(query: unknown): unknown[] {
  if (query && typeof query === 'object') {
    if (
      'queryChunks' in query &&
      Array.isArray((query as { queryChunks: unknown[] }).queryChunks)
    ) {
      return (query as { queryChunks: unknown[] }).queryChunks.flatMap((chunk) =>
        flattenQueryChunks(chunk),
      );
    }

    if ('value' in query) {
      const value = (query as { value: unknown }).value;
      return Array.isArray(value) ? value.flatMap((chunk) => flattenQueryChunks(chunk)) : [value];
    }
  }

  return [query];
}

function queryText(query: unknown) {
  return flattenQueryChunks(query)
    .filter((chunk): chunk is string => typeof chunk === 'string')
    .join(' ');
}

function makeArchivedRecord(
  overrides: Partial<{
    id: string;
    taskKey: string;
    title: string;
    note: string | null;
    branch: string | null;
    project: { id: string; name: string; projectKey: string } | null;
    labels: Array<{ id: string; name: string; color: string }>;
    archivedAt: Date | null;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 'task-1',
    taskKey: overrides.taskKey ?? 'PROJ-1',
    branch: overrides.branch ?? null,
    title: overrides.title ?? 'Archived task',
    note: overrides.note ?? null,
    status: 'archived',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    archivedAt: overrides.archivedAt ?? new Date('2026-03-10T12:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-03-09T09:00:00.000Z'),
    project:
      overrides.project === undefined
        ? { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' }
        : overrides.project,
    label: null,
    labelAssignments: (overrides.labels ?? []).map((label, index) => ({
      position: index,
      label,
    })),
  };
}

describe('app/api/todos/archived/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.db.execute.mockResolvedValue({ rows: [] });
    mocked.db.query.tasks.findMany.mockResolvedValue([]);
  });

  it('returns archived tasks with default pagination and archivedAt ordering fallback metadata', async () => {
    mocked.db.execute.mockResolvedValueOnce({ rows: [{ count: 35 }] }).mockResolvedValueOnce({
      rows: [{ task_id: 'task-fallback' }, { task_id: 'task-2' }, { task_id: 'task-1' }],
    });
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      makeArchivedRecord({
        id: 'task-1',
        taskKey: 'PROJ-1',
        title: 'Older archived task',
        archivedAt: new Date('2026-03-01T08:00:00.000Z'),
        updatedAt: new Date('2026-03-01T09:00:00.000Z'),
      }),
      makeArchivedRecord({
        id: 'task-fallback',
        taskKey: 'PROJ-9',
        title: 'Fallback updated timestamp',
        archivedAt: null,
        updatedAt: new Date('2026-03-30T18:15:00.000Z'),
      }),
      makeArchivedRecord({
        id: 'task-2',
        taskKey: 'PROJ-2',
        title: 'Most recently archived',
        archivedAt: new Date('2026-03-20T08:00:00.000Z'),
        updatedAt: new Date('2026-03-19T09:00:00.000Z'),
      }),
    ]);

    const response = await GET(request(`${TEST_BASE_URL}/api/todos/archived`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(35);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(30);
    expect(body.hasMore).toBe(true);
    expect(body.tasks.map((task: { taskKey: string }) => task.taskKey)).toEqual([
      'PROJ-9',
      'PROJ-2',
      'PROJ-1',
    ]);

    const [, idQueryArg] = mocked.db.execute.mock.calls;
    const sqlText = queryText(idQueryArg?.[0] ?? {});
    expect(sqlText).toContain('coalesce(');
    expect(sqlText).toContain('archived_at');
  });

  it('uses a stable id tie-breaker for archived offset pagination', async () => {
    mocked.db.execute
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 'task-b' }, { task_id: 'task-a' }] });
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      makeArchivedRecord({
        id: 'task-a',
        taskKey: 'PROJ-101',
        title: 'First archived row',
        archivedAt: new Date('2026-03-15T10:00:00.000Z'),
        updatedAt: new Date('2026-03-15T09:00:00.000Z'),
      }),
      makeArchivedRecord({
        id: 'task-b',
        taskKey: 'PROJ-102',
        title: 'Second archived row',
        archivedAt: new Date('2026-03-15T10:00:00.000Z'),
        updatedAt: new Date('2026-03-15T09:00:00.000Z'),
      }),
    ]);

    const response = await GET(request(`${TEST_BASE_URL}/api/todos/archived?offset=30&limit=30`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tasks.map((task: { taskKey: string }) => task.taskKey)).toEqual([
      'PROJ-102',
      'PROJ-101',
    ]);

    const [, idQueryArg] = mocked.db.execute.mock.calls;
    const sqlText = queryText(idQueryArg?.[0] ?? {});
    expect(sqlText).toContain('created_at desc');
    expect(sqlText).toContain('t.id desc');
  });

  it('applies project scope to archived count and page queries', async () => {
    mocked.db.execute
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 'task-22' }] });
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      makeArchivedRecord({
        id: 'task-22',
        taskKey: 'ALPHA-22',
        project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
      }),
    ]);

    const response = await GET(
      request(`${TEST_BASE_URL}/api/todos/archived?projectId=project-1&offset=15&limit=10`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.offset).toBe(15);
    expect(body.limit).toBe(10);
    expect(body.tasks[0]).toEqual(
      expect.objectContaining({
        taskKey: 'ALPHA-22',
        project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
      }),
    );

    const countChunks = flattenQueryChunks(mocked.db.execute.mock.calls[0]?.[0] ?? {});
    const pageChunks = flattenQueryChunks(mocked.db.execute.mock.calls[1]?.[0] ?? {});
    expect(countChunks).toContain('project-1');
    expect(pageChunks).toContain('project-1');
    expect(pageChunks).toContain(10);
    expect(pageChunks).toContain(15);
  });

  it('returns summary metadata without loading archived task rows', async () => {
    mocked.db.execute.mockResolvedValueOnce({ rows: [{ count: 6 }] });

    const response = await GET(
      request(`${TEST_BASE_URL}/api/todos/archived?summaryOnly=1&projectId=project-1`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      tasks: [],
      total: 6,
      offset: 0,
      limit: 30,
      hasMore: false,
    });
    expect(mocked.db.execute).toHaveBeenCalledTimes(1);
    expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
  });

  it('uses search_vector-backed archived search while preserving archived payload serialization', async () => {
    mocked.db.execute
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ task_id: 'task-2' }, { task_id: 'task-1' }] });
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([
      makeArchivedRecord({
        id: 'task-1',
        taskKey: 'PROJ-91',
        title: 'Archive filter follow-up',
        note: 'Needs token cleanup before release',
        branch: 'feature/release-archive-filter',
      }),
      makeArchivedRecord({
        id: 'task-2',
        taskKey: 'PROJ-92',
        title: 'Operations handoff',
        archivedAt: new Date('2026-03-11T12:00:00.000Z'),
        updatedAt: new Date('2026-03-11T11:30:00.000Z'),
        labels: [{ id: 'label-ops', name: 'Operations', color: 'blue' }],
      }),
    ]);

    const response = await GET(
      request(`${TEST_BASE_URL}/api/todos/archived?q=release%20archive%20filter`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.tasks.map((task: { taskKey: string }) => task.taskKey)).toEqual([
      'PROJ-92',
      'PROJ-91',
    ]);

    const searchQueryArg = mocked.db.execute.mock.calls[1]?.[0] ?? {};
    const searchChunks = flattenQueryChunks(searchQueryArg);
    const sqlText = queryText(searchQueryArg);
    expect(sqlText).toContain('search_vector');
    expect(sqlText).toContain("websearch_to_tsquery('simple'");
    expect(searchChunks).toContain('release archive filter');
  });
});
