import { Temporal } from '@js-temporal/polyfill';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import { resolveDisplayTimeZone } from '@/lib/date-time';
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
  const start = Temporal.PlainDate.from({ year: today.year, month: 1, day: 1 });
  const startDate = formatPlainDate(start);
  const endDate = formatPlainDate(today);

  const rows = await client.execute<{ date: string | Date; count: bigint | number }>(sql`
    SELECT bucket_date as date, count
    FROM dashboard_project_work_log_daily
    WHERE owner_id = ${ownerId}::uuid
      AND project_id = ${projectId}::uuid
      AND bucket_date >= ${startDate}::date
      AND bucket_date <= ${endDate}::date
    ORDER BY bucket_date ASC
  `);

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
