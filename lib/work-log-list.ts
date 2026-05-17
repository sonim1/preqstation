import { Temporal } from '@js-temporal/polyfill';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import { getDayRangeForTimeZone, resolveDisplayTimeZone } from '@/lib/date-time';
import { db } from '@/lib/db';
import { workLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { DEFAULT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

type ListWorkLogsPageOptions = {
  ownerId: string;
  projectId?: string | null;
  limit?: number;
  offset?: number;
  includeProject?: boolean;
  client?: DbClientOrTx;
};

type ListProjectWorkLogYearActivityOptions = {
  ownerId: string;
  projectId: string;
  timeZone?: string | null;
  now?: Date;
  client?: DbClientOrTx;
};

type ProjectWorkLogActivityRow = {
  date: string | Date;
  count: bigint | number;
};

function clampPageSize(limit: number) {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_WORK_LOG_PAGE_SIZE;
  return Math.min(Math.trunc(limit), DEFAULT_WORK_LOG_PAGE_SIZE);
}

function normalizeOffset(offset: number) {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.trunc(offset);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatPlainDate(value: Temporal.PlainDate) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
}

function plainDateStartInTimeZone(value: Temporal.PlainDate, timeZone: string) {
  const start = Temporal.ZonedDateTime.from({
    timeZone,
    year: value.year,
    month: value.month,
    day: value.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  });

  return new Date(start.epochMilliseconds);
}

function toTimestampParam(value: Date) {
  return value.toISOString();
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

function readRows<T>(result: unknown): T[] {
  return Array.isArray(result)
    ? (result as T[])
    : Array.isArray((result as { rows?: T[] }).rows)
      ? (result as { rows: T[] }).rows
      : [];
}

function isMissingProjectWorkLogRollupRelationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === '42P01' ||
    Boolean(
      maybeError.message?.includes('does not exist') &&
      maybeError.message.includes('dashboard_project_work_log_daily'),
    )
  );
}

async function loadProjectWorkLogRowsFromSource({
  ownerId,
  projectId,
  start,
  end,
  timeZone,
  client,
}: {
  ownerId: string;
  projectId: string;
  start: string;
  end: string;
  timeZone: string;
  client: DbClientOrTx;
}) {
  const result = await client.execute<ProjectWorkLogActivityRow>(sql`
    SELECT (worked_at AT TIME ZONE ${timeZone})::date as date, COUNT(*)::bigint as count
    FROM work_logs
    WHERE owner_id = ${ownerId}::uuid
      AND project_id = ${projectId}::uuid
      AND worked_at >= ${start}::timestamptz
      AND worked_at < ${end}::timestamptz
    GROUP BY 1
    ORDER BY date ASC
  `);

  return readRows<ProjectWorkLogActivityRow>(result);
}

export async function listWorkLogsPage({
  ownerId,
  projectId = null,
  limit = DEFAULT_WORK_LOG_PAGE_SIZE,
  offset = 0,
  includeProject = false,
  client = db,
}: ListWorkLogsPageOptions) {
  const pageSize = clampPageSize(limit);
  const pageOffset = normalizeOffset(offset);

  const rows = await client.query.workLogs.findMany({
    where: projectId
      ? and(
          eq(workLogs.ownerId, ownerId),
          eq(workLogs.projectId, projectId),
          sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${workLogs.projectId} AND projects.deleted_at IS NULL)`,
        )
      : and(
          eq(workLogs.ownerId, ownerId),
          or(
            isNull(workLogs.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${workLogs.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
    orderBy: [desc(workLogs.workedAt), desc(workLogs.createdAt)],
    offset: pageOffset,
    limit: pageSize + 1,
    with: includeProject
      ? {
          project: {
            columns: { id: true, name: true },
          },
          task: {
            columns: { engine: true },
          },
        }
      : {
          task: {
            columns: { engine: true },
          },
        },
  });

  const hasMore = rows.length > pageSize;

  return {
    workLogs: hasMore ? rows.slice(0, pageSize) : rows,
    nextOffset: hasMore ? pageOffset + pageSize : null,
  };
}

export async function listProjectWorkLogYearActivity({
  ownerId,
  projectId,
  timeZone,
  now = new Date(),
  client = db,
}: ListProjectWorkLogYearActivityOptions) {
  const resolvedTimeZone = resolveDisplayTimeZone(timeZone);
  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(resolvedTimeZone)
    .toPlainDate();
  const start = today.subtract({ days: 364 });
  const startDate = formatPlainDate(start);
  const endDate = formatPlainDate(today);
  const todayRange = getDayRangeForTimeZone(resolvedTimeZone, now);
  const rangeStart = toTimestampParam(plainDateStartInTimeZone(start, resolvedTimeZone));
  const todayStart = toTimestampParam(todayRange.start);
  const todayEnd = toTimestampParam(todayRange.end);

  let rows: ProjectWorkLogActivityRow[];

  try {
    const result = await client.execute<ProjectWorkLogActivityRow>(sql`
      SELECT bucket_date as date, count
      FROM dashboard_project_work_log_daily
      WHERE owner_id = ${ownerId}::uuid
        AND project_id = ${projectId}::uuid
        AND bucket_date >= ${startDate}::date
        AND bucket_date < ${endDate}::date
      UNION ALL
      SELECT ${endDate}::date as date, COUNT(*)::bigint as count
      FROM work_logs
      WHERE owner_id = ${ownerId}::uuid
        AND project_id = ${projectId}::uuid
        AND worked_at >= ${todayStart}::timestamptz
        AND worked_at < ${todayEnd}::timestamptz
      ORDER BY date ASC
    `);

    rows = readRows<ProjectWorkLogActivityRow>(result);
  } catch (error) {
    if (!isMissingProjectWorkLogRollupRelationError(error)) {
      throw error;
    }

    rows = await loadProjectWorkLogRowsFromSource({
      ownerId,
      projectId,
      start: rangeStart,
      end: todayEnd,
      timeZone: resolvedTimeZone,
      client,
    });
  }

  const countByDate = new Map(
    rows.flatMap((row) => {
      const dateKey = toDateKey(row.date);
      if (!dateKey) return [];
      return [[dateKey, Number(row.count)] as const];
    }),
  );
  const activity: Array<{ date: string; count: number }> = [];

  for (
    let cursor = start;
    Temporal.PlainDate.compare(cursor, today) <= 0;
    cursor = cursor.add({ days: 1 })
  ) {
    const date = formatPlainDate(cursor);
    activity.push({ date, count: countByDate.get(date) ?? 0 });
  }

  return activity;
}
