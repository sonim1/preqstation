import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  execute: vi.fn(),
  client: {
    query: {
      workLogs: {
        findMany: vi.fn(),
      },
    },
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: mocked.client,
}));

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

describe('lib/work-log-list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T12:00:00.000Z'));
    mocked.client.execute.mockResolvedValue([
      { date: '2026-01-03', count: 2n },
      { date: '2026-03-05', count: 1 },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads project activity from daily rollups and live-counts today', async () => {
    const workLogList = (await import('@/lib/work-log-list')) as unknown as {
      listProjectWorkLogYearActivity: (options: {
        ownerId: string;
        projectId: string;
        timeZone?: string;
        client: typeof mocked.client;
      }) => Promise<Array<{ date: string; count: number }>>;
    };

    const result = await workLogList.listProjectWorkLogYearActivity({
      ownerId: 'owner-1',
      projectId: 'project-1',
      timeZone: 'UTC',
      client: mocked.client,
    });

    expect(mocked.client.execute).toHaveBeenCalledOnce();
    const [query] = mocked.client.execute.mock.calls[0] ?? [];
    const sqlText = flattenQueryChunks(query)
      .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
      .join(' ');

    const queryChunks = flattenQueryChunks(query);

    expect(sqlText).toContain('dashboard_project_work_log_daily');
    expect(sqlText).toContain('work_logs');
    expect(sqlText).toContain('bucket_date <');
    expect(sqlText).toContain('worked_at >=');
    expect(sqlText).toContain('worked_at <');
    expect(queryChunks.some((chunk) => chunk instanceof Date)).toBe(false);
    expect(queryChunks).toContain('2025-03-06');
    expect(queryChunks).toContain('2026-03-05');
    expect(queryChunks).toContain('2026-03-05T00:00:00.000Z');
    expect(queryChunks).toContain('2026-03-06T00:00:00.000Z');
    expect(flattenQueryChunks(query)).toContain('2026-03-05');
    expect(result[0]).toEqual({ date: '2025-03-06', count: 0 });
    expect(result.find((day) => day.date === '2026-01-03')).toEqual({
      date: '2026-01-03',
      count: 2,
    });
    expect(result.at(-1)).toEqual({ date: '2026-03-05', count: 1 });
    expect(result).toHaveLength(365);
  });

  it('falls back to work logs when project rollup storage is not migrated yet', async () => {
    mocked.client.execute.mockReset();
    mocked.client.execute.mockImplementation(async (query: { queryChunks?: unknown[] }) => {
      const sqlText = flattenQueryChunks(query)
        .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
        .join(' ');

      if (sqlText.includes('dashboard_project_work_log_daily')) {
        throw new Error('relation "dashboard_project_work_log_daily" does not exist');
      }

      if (sqlText.includes('FROM work_logs')) {
        return [
          { date: '2026-01-03', count: 2n },
          { date: '2026-03-05', count: 1 },
        ];
      }

      return [];
    });

    const workLogList = (await import('@/lib/work-log-list')) as unknown as {
      listProjectWorkLogYearActivity: (options: {
        ownerId: string;
        projectId: string;
        timeZone?: string;
        client: typeof mocked.client;
      }) => Promise<Array<{ date: string; count: number }>>;
    };

    const result = await workLogList.listProjectWorkLogYearActivity({
      ownerId: 'owner-1',
      projectId: 'project-1',
      timeZone: 'UTC',
      client: mocked.client,
    });

    expect(mocked.client.execute).toHaveBeenCalledTimes(2);
    const [fallbackQuery] = mocked.client.execute.mock.calls[1] ?? [];
    const fallbackSqlText = flattenQueryChunks(fallbackQuery)
      .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
      .join(' ');

    expect(fallbackSqlText).toContain('FROM work_logs');
    expect(fallbackSqlText).toContain('GROUP BY');
    expect(flattenQueryChunks(fallbackQuery).some((chunk) => chunk instanceof Date)).toBe(false);
    expect(result.find((day) => day.date === '2026-01-03')).toEqual({
      date: '2026-01-03',
      count: 2,
    });
    expect(result.at(-1)).toEqual({ date: '2026-03-05', count: 1 });
  });
});
