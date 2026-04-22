import { Temporal } from '@js-temporal/polyfill';
import { and, asc, desc, eq, isNull, not, or, sql } from 'drizzle-orm';

import { getDayRangeForTimeZone, resolveDisplayTimeZone } from '@/lib/date-time';
import { db } from '@/lib/db';
import { projects, taskLabelAssignments, tasks } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { getProjectActivityStatus } from '@/lib/project-activity';
import { extractTaskLabels } from '@/lib/task-labels';
import { TASK_BOARD_ORDER } from '@/lib/task-sort-order';

function isTransientDashboardError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /connection|closed|timeout|econnreset|terminating connection/i.test(message);
}

function isMissingDashboardRollupRelationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('does not exist') &&
    (message.includes('dashboard_work_log_daily_totals') ||
      message.includes('dashboard_project_work_log_daily'))
  );
}

async function withMissingDashboardRollupFallback<T>(
  promise: Promise<T>,
  label: string,
  fallback: T,
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (!isMissingDashboardRollupRelationError(error)) {
      throw error;
    }

    console.error(`[dashboard] ${label} unavailable, using empty activity data:`, error);
    return fallback;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatPlainDate(value: Temporal.PlainDate) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
}

function getZonedNow(timeZone: string, now: Date) {
  const resolvedTimeZone = resolveDisplayTimeZone(timeZone);
  const zonedNow = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(
    resolvedTimeZone,
  );

  return { resolvedTimeZone, zonedNow };
}

function formatRelativeAge(date: Date, now: Date) {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days}d`;

  return `${Math.floor(days / 7)}w`;
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0] ?? null;

  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0] ?? null;
}

export async function getDashboardData(
  ownerId: string,
  client: DbClientOrTx = db,
  timeZone?: string,
) {
  const now = new Date();
  const resolvedTimeZone = resolveDisplayTimeZone(timeZone);
  const dayRange = getDayRangeForTimeZone(resolvedTimeZone, now);
  const { zonedNow } = getZonedNow(resolvedTimeZone, now);
  const activityWindowStart = formatPlainDate(zonedNow.toPlainDate().subtract({ days: 6 }));

  const loadDashboardSnapshot = () =>
    Promise.all([
      client.query.projects.findMany({
        where: and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)),
        orderBy: [asc(projects.status), desc(projects.updatedAt)],
        limit: 50,
      }),
      client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, ownerId),
          not(eq(tasks.status, 'archived')),
          or(
            isNull(tasks.projectId),
            sql`${tasks.projectId} IN (SELECT id FROM projects WHERE deleted_at IS NULL)`,
          ),
        ),
        orderBy: TASK_BOARD_ORDER,
        limit: 200,
        with: {
          project: {
            columns: { id: true, name: true, projectKey: true },
          },
          label: {
            columns: { id: true, name: true, color: true },
          },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: {
                columns: { id: true, name: true, color: true },
              },
            },
          },
        },
      }),
      withMissingDashboardRollupFallback(
        client.execute<{ date: string | Date; count: bigint | number }>(sql`
          SELECT bucket_date as date, count
          FROM dashboard_work_log_daily_totals
          WHERE owner_id = ${ownerId}::uuid
            AND bucket_date >= ${activityWindowStart}::date
          ORDER BY date ASC
        `),
        'dashboard_work_log_daily_totals',
        [] as Array<{ date: string | Date; count: bigint | number }>,
      ),
      withMissingDashboardRollupFallback(
        client.execute<{ project_id: string; date: string | Date; count: bigint | number }>(sql`
          SELECT project_id, bucket_date as date, count
          FROM dashboard_project_work_log_daily
          WHERE owner_id = ${ownerId}::uuid
            AND bucket_date >= ${activityWindowStart}::date
          ORDER BY project_id ASC, 2 ASC
        `),
        'dashboard_project_work_log_daily',
        [] as Array<{ project_id: string; date: string | Date; count: bigint | number }>,
      ),
      client.execute<{ project_id: string; last_worked_at: Date | string | null }>(sql`
        SELECT project_id, MAX(worked_at) as last_worked_at
        FROM work_logs
        WHERE owner_id = ${ownerId}::uuid
          AND project_id IS NOT NULL
          AND project_id IN (SELECT id FROM projects WHERE deleted_at IS NULL)
        GROUP BY project_id
      `),
    ]);

  let dashboardSnapshot: Awaited<ReturnType<typeof loadDashboardSnapshot>> | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      dashboardSnapshot = await loadDashboardSnapshot();
      break;
    } catch (error) {
      if (!isTransientDashboardError(error) || attempt === 1) {
        throw error;
      }
      await delay(120);
    }
  }

  if (!dashboardSnapshot) {
    throw new Error('Failed to load dashboard data');
  }

  const [projectsList, todos, weeklyActivityRaw, projectActivityRaw, projectLatestWorkRaw] =
    dashboardSnapshot;

  const weeklyActivityRows = weeklyActivityRaw;
  const projectActivityRows = projectActivityRaw;
  const projectLatestWorkRows = projectLatestWorkRaw;
  const todoItems = todos.map((todo) => ({
    ...todo,
    labels: extractTaskLabels(todo),
  }));

  const activityMap = new Map(
    weeklyActivityRows.flatMap((row) => {
      const dateKey = toDateKey(row.date);
      if (!dateKey) return [];
      return [[dateKey, Number(row.count)] as const];
    }),
  );
  const activityDays = Array.from({ length: 7 }, (_, index) =>
    formatPlainDate(zonedNow.toPlainDate().subtract({ days: 6 - index })),
  );
  const weeklyActivity = activityDays.map((date) => ({
    date,
    count: activityMap.get(date) ?? 0,
  }));

  const projectLastWorkedAt = new Map(
    projectLatestWorkRows.flatMap((row) => {
      const lastWorkedAt = toValidDate(row.last_worked_at);
      if (!row.project_id || !lastWorkedAt) return [];
      return [[row.project_id, lastWorkedAt] as const];
    }),
  );

  const projectDailyActivity = new Map<string, Map<string, number>>();
  for (const row of projectActivityRows) {
    const projectId = row.project_id;
    const dateKey = toDateKey(row.date);
    if (!projectId || !dateKey) continue;

    const current = projectDailyActivity.get(projectId) ?? new Map<string, number>();
    current.set(dateKey, Number(row.count));
    projectDailyActivity.set(projectId, current);
  }

  const todayTodos = todoItems.filter(
    (todo) =>
      todo.status === 'todo' &&
      !!todo.dueAt &&
      todo.dueAt.getTime() >= dayRange.start.getTime() &&
      todo.dueAt.getTime() < dayRange.end.getTime(),
  );

  const todoCount = todoItems.filter((todo) => todo.status === 'todo').length;
  const holdCount = todoItems.filter((todo) => todo.status === 'hold').length;
  const doneCount = todoItems.filter((todo) => todo.status === 'done').length;
  const archivedCount = todoItems.filter((todo) => todo.status === 'archived').length;
  const repoConnected = projectsList.filter((project) => !!project.repoUrl).length;
  const vercelConnected = projectsList.filter((project) => !!project.vercelUrl).length;

  const weeklyDoneCount = weeklyActivity.reduce((sum, point) => sum + point.count, 0);

  const portfolioProjects = projectsList.filter((project) => project.status !== 'done');

  const todosByProjectId = new Map<
    string,
    {
      inboxCount: number;
      todoCount: number;
      holdCount: number;
      readyCount: number;
      doneCount: number;
      openTaskCount: number;
    }
  >();

  for (const todo of todoItems) {
    if (!todo.projectId) continue;

    const current = todosByProjectId.get(todo.projectId) ?? {
      inboxCount: 0,
      todoCount: 0,
      holdCount: 0,
      readyCount: 0,
      doneCount: 0,
      openTaskCount: 0,
    };

    if (todo.status === 'inbox') current.inboxCount += 1;
    if (todo.status === 'todo') current.todoCount += 1;
    if (todo.status === 'hold') current.holdCount += 1;
    if (todo.status === 'ready') current.readyCount += 1;
    if (todo.status === 'done') current.doneCount += 1;
    if (todo.status !== 'archived' && todo.status !== 'done') current.openTaskCount += 1;

    todosByProjectId.set(todo.projectId, current);
  }

  const portfolioProjectSummaries = portfolioProjects.map((project) => {
    const counts = todosByProjectId.get(project.id) ?? {
      inboxCount: 0,
      todoCount: 0,
      holdCount: 0,
      readyCount: 0,
      doneCount: 0,
      openTaskCount: 0,
    };
    const lastWorkedAt = projectLastWorkedAt.get(project.id) ?? null;
    const recentActivityDates = Array.from(projectDailyActivity.get(project.id)?.keys() ?? []);
    const lastRecentActivityAt =
      recentActivityDates.length > 0
        ? toValidDate(`${recentActivityDates[recentActivityDates.length - 1]}T12:00:00.000Z`)
        : null;
    const lastActivityAt =
      lastWorkedAt ?? lastRecentActivityAt ?? toValidDate(project.updatedAt) ?? now;
    const activityStatus = getProjectActivityStatus({
      projectStatus: project.status,
      lastWorkedAt,
      now,
    }).status;

    let bucket: 'moving' | 'watch' | 'risk' | 'quiet' = 'moving';
    if (project.status === 'paused') {
      bucket = 'quiet';
    } else if (activityStatus === 'critical' || counts.holdCount >= 2) {
      bucket = 'risk';
    } else if (
      activityStatus === 'warning' ||
      counts.holdCount === 1 ||
      counts.openTaskCount >= 6
    ) {
      bucket = 'watch';
    }

    return {
      id: project.id,
      name: project.name,
      projectKey: project.projectKey,
      status: project.status,
      bucket,
      repoLinked: Boolean(project.repoUrl),
      deployLinked: Boolean(project.vercelUrl),
      lastActivityAt,
      ageLabel: formatRelativeAge(lastActivityAt, now),
      activityStatus,
      ...counts,
      activity: activityDays.map((date) => ({
        date,
        count: projectDailyActivity.get(project.id)?.get(date) ?? 0,
      })),
    };
  });

  const distribution = portfolioProjectSummaries.reduce(
    (acc, project) => {
      acc[project.bucket] += 1;
      return acc;
    },
    { moving: 0, watch: 0, risk: 0, quiet: 0 },
  );

  const summaryCounts = {
    needsAttention: distribution.risk,
    readyToPush: portfolioProjectSummaries.filter(
      (project) => project.status === 'active' && project.readyCount > 0 && project.holdCount === 0,
    ).length,
    longQuiet: portfolioProjectSummaries.filter(
      (project) =>
        project.status === 'paused' ||
        now.getTime() - project.lastActivityAt.getTime() > 7 * 86_400_000,
    ).length,
  };

  const bucketPriority = { risk: 3, watch: 2, moving: 1, quiet: 0 };

  const mostUrgent =
    portfolioProjectSummaries
      .filter((project) => project.status === 'active')
      .sort((a, b) => {
        const priorityDelta = bucketPriority[b.bucket] - bucketPriority[a.bucket];
        if (priorityDelta !== 0) return priorityDelta;
        if (b.holdCount !== a.holdCount) return b.holdCount - a.holdCount;
        if (b.openTaskCount !== a.openTaskCount) return b.openTaskCount - a.openTaskCount;
        if (a.lastActivityAt.getTime() !== b.lastActivityAt.getTime()) {
          return a.lastActivityAt.getTime() - b.lastActivityAt.getTime();
        }
        return a.name.localeCompare(b.name);
      })[0] ?? null;

  const mostReady =
    portfolioProjectSummaries
      .filter((project) => project.status === 'active' && project.readyCount > 0)
      .sort((a, b) => {
        if (b.readyCount !== a.readyCount) return b.readyCount - a.readyCount;
        if (a.holdCount !== b.holdCount) return a.holdCount - b.holdCount;
        if (a.lastActivityAt.getTime() !== b.lastActivityAt.getTime()) {
          return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
        }
        return a.name.localeCompare(b.name);
      })[0] ?? null;

  const quietest =
    portfolioProjectSummaries
      .filter(
        (project) =>
          project.status === 'paused' ||
          now.getTime() - project.lastActivityAt.getTime() > 7 * 86_400_000,
      )
      .sort((a, b) => {
        if (a.lastActivityAt.getTime() !== b.lastActivityAt.getTime()) {
          return a.lastActivityAt.getTime() - b.lastActivityAt.getTime();
        }
        if (a.openTaskCount !== b.openTaskCount) return a.openTaskCount - b.openTaskCount;
        return a.name.localeCompare(b.name);
      })[0] ?? null;

  const activityStrips = portfolioProjectSummaries
    .filter(
      (project) =>
        project.status === 'active' &&
        now.getTime() - project.lastActivityAt.getTime() <= 7 * 86_400_000,
    )
    .sort((a, b) => {
      const activityTotalA = a.activity.reduce((sum, point) => sum + point.count, 0);
      const activityTotalB = b.activity.reduce((sum, point) => sum + point.count, 0);

      if (activityTotalB !== activityTotalA) return activityTotalB - activityTotalA;
      if (a.lastActivityAt.getTime() !== b.lastActivityAt.getTime()) {
        return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
      }
      if (bucketPriority[b.bucket] !== bucketPriority[a.bucket]) {
        return bucketPriority[b.bucket] - bucketPriority[a.bucket];
      }
      return a.name.localeCompare(b.name);
    })
    .map((project) => ({
      id: project.id,
      projectKey: project.projectKey,
      name: project.name,
      status: project.status,
      bucket: project.bucket,
      ageLabel: project.ageLabel,
      pills: [
        project.holdCount > 0 ? `hold ${project.holdCount}` : null,
        project.readyCount > 0 ? `ready ${project.readyCount}` : null,
        project.status === 'paused' ? 'paused' : null,
        project.deployLinked ? 'deploy' : project.repoLinked ? 'repo' : null,
      ].filter(Boolean) as string[],
      activity: project.activity,
    }));

  const exceptionRows = {
    mostUrgent,
    mostReady,
    quietest,
  };

  const matrixProjects = portfolioProjectSummaries.map((project) => ({
    id: project.id,
    projectKey: project.projectKey,
    name: project.name,
    bucket: project.bucket,
    status: project.status,
    recencyDays: Math.max(
      0,
      Math.floor((now.getTime() - project.lastActivityAt.getTime()) / 86_400_000),
    ),
    openTaskCount: project.openTaskCount,
  }));

  const portfolioOverview = {
    distribution,
    summaryCounts,
    exceptionRows,
    matrixProjects,
    activityStrips,
  };

  return {
    projects: projectsList,
    todos: todoItems,
    weeklyActivity,
    portfolioOverview,
    metrics: {
      todayTodos: todayTodos.length,
      todoCount,
      holdCount,
      doneCount,
      archivedCount,
      repoConnected,
      vercelConnected,
      weeklyDoneCount,
    },
  };
}
