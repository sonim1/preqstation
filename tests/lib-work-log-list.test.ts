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

  it('loads project activity from yearly daily rollups and gap-fills year-to-date days', async () => {
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

    expect(sqlText).toContain('dashboard_project_work_log_daily');
    expect(flattenQueryChunks(query)).toContain('2026-01-01');
    expect(flattenQueryChunks(query)).toContain('2026-03-05');
    expect(result[0]).toEqual({ date: '2026-01-01', count: 0 });
    expect(result[2]).toEqual({ date: '2026-01-03', count: 2 });
    expect(result.at(-1)).toEqual({ date: '2026-03-05', count: 1 });
    expect(result).toHaveLength(64);
  });
});
