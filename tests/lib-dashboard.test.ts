import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TASK_BOARD_ORDER } from '@/lib/task-sort-order';

const mocked = vi.hoisted(() => {
  const projectsFindMany = vi.fn();
  const tasksFindMany = vi.fn();
  const workLogsFindMany = vi.fn();
  const execute = vi.fn();

  return {
    projectsFindMany,
    tasksFindMany,
    workLogsFindMany,
    execute,
    db: {
      query: {
        projects: {
          findMany: projectsFindMany,
        },
        tasks: {
          findMany: tasksFindMany,
        },
        workLogs: {
          findMany: workLogsFindMany,
        },
      },
      execute,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

import { getDashboardData } from '@/lib/dashboard';

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

describe('lib/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));

    mocked.projectsFindMany.mockResolvedValue([]);
    mocked.tasksFindMany.mockResolvedValue([]);
    mocked.workLogsFindMany.mockResolvedValue([]);
    mocked.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries dashboard rollups with local date filters and drops unused dashboard payloads', async () => {
    const result = await getDashboardData('owner-1');

    expect(mocked.execute).toHaveBeenCalledTimes(3);
    expect(mocked.workLogsFindMany).not.toHaveBeenCalled();

    const [weeklyActivityQuery] = mocked.execute.mock.calls[0] ?? [];
    const [projectActivityQuery] = mocked.execute.mock.calls[1] ?? [];
    const [latestProjectWorkQuery] = mocked.execute.mock.calls[2] ?? [];

    const weeklyActivityChunks = flattenQueryChunks(weeklyActivityQuery);
    const projectActivityChunks = flattenQueryChunks(projectActivityQuery);
    const latestProjectWorkChunks = flattenQueryChunks(latestProjectWorkQuery);

    const weeklyActivitySql = weeklyActivityChunks
      .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
      .join(' ');
    const projectActivitySql = projectActivityChunks
      .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
      .join(' ');
    const latestProjectWorkSql = latestProjectWorkChunks
      .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
      .join(' ');

    expect(weeklyActivitySql).toContain('dashboard_work_log_daily_totals');
    expect(projectActivitySql).toContain('dashboard_project_work_log_daily');
    expect(latestProjectWorkSql).toContain('MAX(worked_at)');
    expect(weeklyActivityChunks).toContain('2026-03-19');
    expect(projectActivityChunks).toContain('2026-03-19');
    expect(weeklyActivitySql).not.toContain('DATE(worked_at)');
    expect(projectActivitySql).not.toContain('AT TIME ZONE');
    expect(result).not.toHaveProperty('dailyActivity');
    expect(result).not.toHaveProperty('yearlyActivity');
    expect(result).not.toHaveProperty('funnelData');
    expect(result).not.toHaveProperty('workLogs');
  });

  it('uses the saved timezone when building dashboard rollup day filters', async () => {
    const getDashboardDataWithTimezone = getDashboardData as unknown as (
      ownerId: string,
      client?: unknown,
      timeZone?: string,
    ) => Promise<unknown>;

    await getDashboardDataWithTimezone('owner-1', undefined, 'Pacific/Auckland');

    const [weeklyActivityQuery] = mocked.execute.mock.calls[0] ?? [];
    const [projectActivityQuery] = mocked.execute.mock.calls[1] ?? [];

    const weeklyActivityChunks = flattenQueryChunks(weeklyActivityQuery);
    const projectActivityChunks = flattenQueryChunks(projectActivityQuery);

    expect(weeklyActivityChunks).toContain('2026-03-20');
    expect(projectActivityChunks).toContain('2026-03-20');
  });

  it('returns a gap-filled weekly activity series from rollup rows', async () => {
    const getDashboardDataWithTimezone = getDashboardData as unknown as (
      ownerId: string,
      client?: unknown,
      timeZone?: string,
    ) => Promise<Awaited<ReturnType<typeof getDashboardData>>>;

    mocked.execute.mockReset();
    mocked.execute.mockImplementation(async (query: { queryChunks?: unknown[] }) => {
      const chunks = flattenQueryChunks(query);
      const sql = chunks
        .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
        .join(' ');

      if (sql.includes('dashboard_work_log_daily_totals')) {
        return [
          { date: '2026-03-20', count: 1n },
          { date: '2026-03-24', count: 2n },
        ];
      }

      if (sql.includes('dashboard_project_work_log_daily')) {
        return [];
      }

      if (sql.includes('MAX(worked_at)')) {
        return [];
      }

      return [];
    });

    const result = await getDashboardDataWithTimezone('owner-1', undefined, 'America/Toronto');

    expect(result.weeklyActivity).toEqual([
      { date: '2026-03-19', count: 0 },
      { date: '2026-03-20', count: 1 },
      { date: '2026-03-21', count: 0 },
      { date: '2026-03-22', count: 0 },
      { date: '2026-03-23', count: 0 },
      { date: '2026-03-24', count: 2 },
      { date: '2026-03-25', count: 0 },
    ]);
    expect(result.metrics.weeklyDoneCount).toBe(3);
  });

  it('treats missing dashboard rollup relations as empty activity data', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      mocked.projectsFindMany.mockResolvedValue([
        {
          id: 'project-1',
          name: 'Project One',
          projectKey: 'PROJ',
          status: 'active',
          updatedAt: new Date('2026-03-25T11:00:00.000Z'),
          repoUrl: null,
          vercelUrl: null,
        },
      ]);
      mocked.tasksFindMany.mockResolvedValue([
        {
          id: 'todo-1',
          taskKey: 'PROJ-1',
          title: 'Keep the dashboard up',
          status: 'todo',
          dueAt: null,
          focusedAt: null,
          sortOrder: 'a0',
          createdAt: new Date('2026-03-25T09:00:00.000Z'),
          projectId: 'project-1',
          project: { id: 'project-1', name: 'Project One', projectKey: 'PROJ' },
          labelAssignments: [],
          label: null,
        },
      ]);
      mocked.execute.mockReset();
      mocked.execute.mockImplementation(async (query: { queryChunks?: unknown[] }) => {
        const sql = flattenQueryChunks(query)
          .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
          .join(' ');

        if (sql.includes('dashboard_work_log_daily_totals')) {
          throw new Error('relation "dashboard_work_log_daily_totals" does not exist');
        }

        if (sql.includes('dashboard_project_work_log_daily')) {
          throw new Error('relation "dashboard_project_work_log_daily" does not exist');
        }

        if (sql.includes('MAX(worked_at)')) {
          return [
            {
              project_id: 'project-1',
              last_worked_at: new Date('2026-03-25T10:00:00.000Z'),
            },
          ];
        }

        return [];
      });

      const result = await getDashboardData('owner-1');

      expect(result.weeklyActivity.every((point) => point.count === 0)).toBe(true);
      expect(result.metrics.weeklyDoneCount).toBe(0);
      expect(result.portfolioOverview.activityStrips).toHaveLength(1);
      expect(
        result.portfolioOverview.activityStrips[0]?.activity.every((point) => point.count === 0),
      ).toBe(true);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('still throws non-rollup dashboard query failures', async () => {
    mocked.execute.mockReset();
    mocked.execute.mockImplementation(async (query: { queryChunks?: unknown[] }) => {
      const sql = flattenQueryChunks(query)
        .map((chunk) => (typeof chunk === 'string' ? chunk : String(chunk)))
        .join(' ');

      if (sql.includes('dashboard_work_log_daily_totals')) {
        throw new Error('permission denied for relation dashboard_work_log_daily_totals');
      }

      return [];
    });

    await expect(getDashboardData('owner-1')).rejects.toThrow(
      'permission denied for relation dashboard_work_log_daily_totals',
    );
  });

  it('uses the shared board-order contract for dashboard task snapshots', async () => {
    await getDashboardData('owner-1');

    expect(mocked.tasksFindMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ orderBy: TASK_BOARD_ORDER }),
    );
  });

  it('returns deterministic portfolio overview data for the dashboard', async () => {
    mocked.projectsFindMany.mockResolvedValue([
      {
        id: 'project-moving',
        name: 'Moving Project',
        projectKey: 'MOVE',
        status: 'active',
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
        repoUrl: 'https://github.com/example/move',
        vercelUrl: 'https://move.vercel.app',
      },
      {
        id: 'project-watch',
        name: 'Watch Project',
        projectKey: 'WATCH',
        status: 'active',
        updatedAt: new Date('2026-03-24T11:00:00.000Z'),
        repoUrl: null,
        vercelUrl: null,
      },
      {
        id: 'project-risk',
        name: 'Risk Project',
        projectKey: 'RISK',
        status: 'active',
        updatedAt: new Date('2026-03-10T11:00:00.000Z'),
        repoUrl: 'https://github.com/example/risk',
        vercelUrl: null,
      },
      {
        id: 'project-quiet',
        name: 'Quiet Project',
        projectKey: 'QUIET',
        status: 'paused',
        updatedAt: new Date('2026-03-01T11:00:00.000Z'),
        repoUrl: null,
        vercelUrl: null,
      },
      {
        id: 'project-active-two',
        name: 'Second Active Project',
        projectKey: 'ACT2',
        status: 'active',
        updatedAt: new Date('2026-03-23T11:00:00.000Z'),
        repoUrl: null,
        vercelUrl: null,
      },
      {
        id: 'project-done',
        name: 'Done Project',
        projectKey: 'DONE',
        status: 'done',
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
        repoUrl: null,
        vercelUrl: null,
      },
    ]);

    mocked.tasksFindMany.mockResolvedValue([
      {
        id: 'todo-move-ready',
        taskKey: 'MOVE-1',
        title: 'Ready to ship',
        status: 'ready',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a0',
        createdAt: new Date('2026-03-25T09:00:00.000Z'),
        projectId: 'project-moving',
        project: { id: 'project-moving', name: 'Moving Project', projectKey: 'MOVE' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-move-todo',
        taskKey: 'MOVE-2',
        title: 'In progress',
        status: 'todo',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a1',
        createdAt: new Date('2026-03-24T09:00:00.000Z'),
        projectId: 'project-moving',
        project: { id: 'project-moving', name: 'Moving Project', projectKey: 'MOVE' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-watch-hold',
        taskKey: 'WATCH-1',
        title: 'Single blocker',
        status: 'hold',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a0',
        createdAt: new Date('2026-03-22T09:00:00.000Z'),
        projectId: 'project-watch',
        project: { id: 'project-watch', name: 'Watch Project', projectKey: 'WATCH' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-risk-hold-1',
        taskKey: 'RISK-1',
        title: 'Blocked one',
        status: 'hold',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a0',
        createdAt: new Date('2026-03-20T09:00:00.000Z'),
        projectId: 'project-risk',
        project: { id: 'project-risk', name: 'Risk Project', projectKey: 'RISK' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-risk-hold-2',
        taskKey: 'RISK-2',
        title: 'Blocked two',
        status: 'hold',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a1',
        createdAt: new Date('2026-03-19T09:00:00.000Z'),
        projectId: 'project-risk',
        project: { id: 'project-risk', name: 'Risk Project', projectKey: 'RISK' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-active-two',
        taskKey: 'ACT2-1',
        title: 'Warm queue',
        status: 'todo',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a0',
        createdAt: new Date('2026-03-21T09:00:00.000Z'),
        projectId: 'project-active-two',
        project: { id: 'project-active-two', name: 'Second Active Project', projectKey: 'ACT2' },
        labelAssignments: [],
        label: null,
      },
      {
        id: 'todo-done',
        taskKey: 'DONE-1',
        title: 'Completed project task',
        status: 'done',
        dueAt: null,
        focusedAt: null,
        sortOrder: 'a0',
        createdAt: new Date('2026-03-18T09:00:00.000Z'),
        projectId: 'project-done',
        project: { id: 'project-done', name: 'Done Project', projectKey: 'DONE' },
        labelAssignments: [],
        label: null,
      },
    ]);

    mocked.execute.mockReset();
    mocked.execute
      .mockResolvedValueOnce([
        { date: '2026-03-24', count: 2n },
        { date: '2026-03-25', count: 1n },
      ])
      .mockResolvedValueOnce([
        { project_id: 'project-moving', date: new Date('2026-03-24T00:00:00.000Z'), count: 2n },
        { project_id: 'project-moving', date: new Date('2026-03-25T00:00:00.000Z'), count: 1n },
        { project_id: 'project-watch', date: new Date('2026-03-23T00:00:00.000Z'), count: 1n },
        { project_id: 'project-risk', date: new Date('2026-03-20T00:00:00.000Z'), count: 1n },
        { project_id: 'project-active-two', date: new Date('2026-03-22T00:00:00.000Z'), count: 1n },
      ])
      .mockResolvedValueOnce([
        { project_id: 'project-moving', last_worked_at: new Date('2026-03-25T09:00:00.000Z') },
        { project_id: 'project-watch', last_worked_at: new Date('2026-03-23T09:00:00.000Z') },
        { project_id: 'project-risk', last_worked_at: new Date('2026-03-20T09:00:00.000Z') },
        {
          project_id: 'project-active-two',
          last_worked_at: new Date('2026-03-22T09:00:00.000Z'),
        },
      ]);

    const result = await getDashboardData('owner-1');

    expect(result.portfolioOverview.summaryCounts).toEqual({
      needsAttention: 1,
      readyToPush: 1,
      longQuiet: 1,
    });
    expect(result.portfolioOverview.exceptionRows.mostUrgent?.projectKey).toBe('RISK');
    expect(result.portfolioOverview.exceptionRows.mostReady?.projectKey).toBe('MOVE');
    expect(result.portfolioOverview.exceptionRows.quietest?.projectKey).toBe('QUIET');
    expect(result.portfolioOverview.activityStrips).toHaveLength(4);
    expect(
      result.portfolioOverview.activityStrips.map((project) => project.projectKey),
    ).not.toContain('DONE');
    expect(
      result.portfolioOverview.activityStrips.map((project) => project.projectKey),
    ).not.toContain('QUIET');
    expect(result.portfolioOverview.activityStrips.map((project) => project.projectKey)).toContain(
      'RISK',
    );
  });

  it('retries once when a transient dashboard query failure occurs', async () => {
    mocked.projectsFindMany
      .mockRejectedValueOnce(new Error('connection closed unexpectedly'))
      .mockResolvedValueOnce([]);
    mocked.tasksFindMany.mockResolvedValue([]);
    mocked.execute.mockResolvedValue([]);

    const pending = getDashboardData('owner-1');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({
      projects: [],
      todos: [],
    });
    expect(mocked.projectsFindMany).toHaveBeenCalledTimes(2);
  });
});
