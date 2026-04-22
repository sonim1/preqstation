import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

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

function clampPageSize(limit: number) {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_WORK_LOG_PAGE_SIZE;
  return Math.min(Math.trunc(limit), DEFAULT_WORK_LOG_PAGE_SIZE);
}

function normalizeOffset(offset: number) {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.trunc(offset);
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
