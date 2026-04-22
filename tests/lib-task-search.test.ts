import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

import { searchTasksForBoard } from '@/lib/task-search';

function flattenQueryChunks(query: { queryChunks?: unknown[] }) {
  return (query.queryChunks ?? []).flatMap((chunk) => {
    if (
      chunk &&
      typeof chunk === 'object' &&
      'value' in chunk &&
      Array.isArray((chunk as { value: unknown }).value)
    ) {
      return (chunk as { value: string[] }).value;
    }
    return [chunk];
  });
}

describe('lib/task-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.execute.mockResolvedValue({ rows: [] });
  });

  it('returns no search work for a blank query', async () => {
    await expect(
      searchTasksForBoard({
        ownerId: 'owner-1',
        query: '   ',
      }),
    ).resolves.toEqual([]);

    expect(mocked.db.execute).not.toHaveBeenCalled();
  });

  it('calls search_tasks_fts with owner, query, project scope, and capped limit', async () => {
    mocked.db.execute.mockResolvedValueOnce({
      rows: [{ task_id: 'task-1', score: 12.5 }],
    });

    const results = await searchTasksForBoard({
      ownerId: 'owner-1',
      query: '로그인',
      projectId: 'project-1',
      limit: 999,
    });

    expect(results).toEqual([{ taskId: 'task-1', score: 12.5 }]);
    expect(mocked.db.execute).toHaveBeenCalledTimes(1);

    const [queryArg] = mocked.db.execute.mock.calls[0] ?? [];
    const chunks = flattenQueryChunks(queryArg);

    expect(chunks[0]).toContain('search_tasks_fts(');
    expect(chunks).toContain('owner-1');
    expect(chunks).toContain('로그인');
    expect(chunks).toContain('project-1');
    expect(chunks).toContain(50);
  });

  it('keeps explicit small limits and maps ordered ids and scores', async () => {
    mocked.db.execute.mockResolvedValueOnce({
      rows: [
        { task_id: 'task-2', score: '9.25' },
        { task_id: 'task-3', score: 4 },
      ],
    });

    await expect(
      searchTasksForBoard({
        ownerId: 'owner-1',
        query: '배포 실패',
        limit: 10,
      }),
    ).resolves.toEqual([
      { taskId: 'task-2', score: 9.25 },
      { taskId: 'task-3', score: 4 },
    ]);

    const [queryArg] = mocked.db.execute.mock.calls[0] ?? [];
    const chunks = flattenQueryChunks(queryArg);

    expect(chunks[0]).toContain('search_tasks_fts(');
    expect(chunks).toContain(10);
  });
});
