import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

import { resetSearchTasksFunctionCacheForTests, searchTasksForBoard } from '@/lib/task-search';

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
    resetSearchTasksFunctionCacheForTests();
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
      rows: [{ search_function: 'search_tasks_fts(uuid,text,uuid,integer)' }],
    });
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
    expect(mocked.db.execute).toHaveBeenCalledTimes(2);

    const [queryArg] = mocked.db.execute.mock.calls[1] ?? [];
    const chunks = flattenQueryChunks(queryArg);

    expect(chunks[0]).toContain('search_tasks_fts(');
    expect(chunks).toContain('owner-1');
    expect(chunks).toContain('로그인');
    expect(chunks).toContain('project-1');
    expect(chunks).toContain(50);
  });

  it('keeps explicit small limits and maps ordered ids and scores', async () => {
    mocked.db.execute.mockResolvedValueOnce({
      rows: [{ search_function: 'search_tasks_fts(uuid,text,uuid,integer)' }],
    });
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

    const [queryArg] = mocked.db.execute.mock.calls[1] ?? [];
    const chunks = flattenQueryChunks(queryArg);

    expect(chunks[0]).toContain('search_tasks_fts(');
    expect(chunks).toContain(10);
  });

  it('falls back to direct task matching when the FTS helper function is missing', async () => {
    mocked.db.execute
      .mockResolvedValueOnce({ rows: [{ search_function: null }] })
      .mockResolvedValueOnce({
        rows: [{ task_id: 'task-5', score: '30' }],
      });

    await expect(
      searchTasksForBoard({
        ownerId: 'owner-1',
        query: 'QA',
        projectId: null,
      }),
    ).resolves.toEqual([{ taskId: 'task-5', score: 30 }]);

    expect(mocked.db.execute).toHaveBeenCalledTimes(2);
    const [fallbackQuery] = mocked.db.execute.mock.calls[1] ?? [];
    const chunks = flattenQueryChunks(fallbackQuery);

    expect(chunks.join('')).toContain('from tasks t');
    expect(chunks).toContain('%QA%');
    expect(chunks).toContain(50);
  });

  it('caches the FTS helper function check after the first successful probe', async () => {
    mocked.db.execute
      .mockResolvedValueOnce({
        rows: [{ search_function: 'search_tasks_fts(uuid,text,uuid,integer)' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await searchTasksForBoard({
      ownerId: 'owner-1',
      query: 'first',
    });
    await searchTasksForBoard({
      ownerId: 'owner-1',
      query: 'second',
    });

    expect(mocked.db.execute).toHaveBeenCalledTimes(3);
    const queryTexts = mocked.db.execute.mock.calls.map(([queryArg]) =>
      flattenQueryChunks(queryArg).join(''),
    );
    expect(queryTexts.filter((queryText) => queryText.includes('to_regprocedure')).length).toBe(1);
    expect(
      queryTexts.filter((queryText) => queryText.includes('from search_tasks_fts(')).length,
    ).toBe(2);
  });
});
