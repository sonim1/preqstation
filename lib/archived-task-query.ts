import { asc, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { taskLabelAssignments, tasks } from '@/lib/db/schema';
import { type KanbanTask, toKanbanTask } from '@/lib/kanban-helpers';

const DEFAULT_ARCHIVED_TASK_LIMIT = 30;
const MAX_ARCHIVED_TASK_LIMIT = 100;

type ArchivedTaskQueryParams = {
  ownerId: string;
  projectId?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
  summaryOnly?: boolean;
};

export type ArchivedTaskQueryResult = {
  tasks: KanbanTask[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

type ExecuteRowResult<T> = T[] | { rows?: T[] };

function clampArchivedTaskLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_ARCHIVED_TASK_LIMIT;
  const normalized = Math.trunc(limit as number);
  if (normalized < 1) return 1;
  return Math.min(normalized, MAX_ARCHIVED_TASK_LIMIT);
}

function clampArchivedTaskOffset(offset?: number) {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset as number));
}

function rowsFromExecute<T>(result: ExecuteRowResult<T>): T[] {
  return Array.isArray(result) ? result : Array.isArray(result.rows) ? result.rows : [];
}

function archivedScopeSql(params: { ownerId: string; projectId: string | null }) {
  if (params.projectId) {
    return sql`
      where t.owner_id = ${params.ownerId}
        and t.project_id = ${params.projectId}
        and t.status = 'archived'
    `;
  }

  return sql`
    where t.owner_id = ${params.ownerId}
      and t.status = 'archived'
      and (
        t.project_id is null
        or exists (
          select 1
          from projects p
          where p.id = t.project_id
            and p.deleted_at is null
        )
      )
  `;
}

function archivedSearchSql(query: string) {
  if (!query) {
    return sql``;
  }

  return sql`
    and (
      t.search_vector @@ websearch_to_tsquery('simple', ${query})
      or t.task_key = ${query}
    )
  `;
}

export async function queryArchivedTasks({
  ownerId,
  projectId = null,
  query = null,
  limit,
  offset,
  summaryOnly = false,
}: ArchivedTaskQueryParams): Promise<ArchivedTaskQueryResult> {
  const normalizedLimit = clampArchivedTaskLimit(limit);
  const normalizedOffset = clampArchivedTaskOffset(offset);
  const trimmedQuery = (query ?? '').trim();
  const scopeSql = archivedScopeSql({ ownerId, projectId });
  const searchSql = archivedSearchSql(trimmedQuery);

  const totalRows = rowsFromExecute<{ count: number | string }>(
    await db.execute(sql`
      select count(*)::int as count
      from tasks t
      ${scopeSql}
      ${searchSql}
    `),
  );
  const total = totalRows[0] ? Number(totalRows[0].count) : 0;

  if (summaryOnly || total === 0) {
    return {
      tasks: [],
      total,
      offset: normalizedOffset,
      limit: normalizedLimit,
      hasMore: normalizedOffset + normalizedLimit < total,
    };
  }

  const pageRows = rowsFromExecute<{ task_id: string }>(
    await db.execute(sql`
      select t.id as task_id
      from tasks t
      ${scopeSql}
      ${searchSql}
      order by
        coalesce(t.archived_at, t.updated_at) desc,
        t.updated_at desc,
        t.created_at desc,
        t.id desc
      limit ${normalizedLimit}
      offset ${normalizedOffset}
    `),
  );
  const orderedTaskIds = pageRows.map((row) => row.task_id);

  if (orderedTaskIds.length === 0) {
    return {
      tasks: [],
      total,
      offset: normalizedOffset,
      limit: normalizedLimit,
      hasMore: normalizedOffset + normalizedLimit < total,
    };
  }

  const records = await db.query.tasks.findMany({
    where: inArray(tasks.id, orderedTaskIds),
    with: {
      project: { columns: { id: true, name: true, projectKey: true } },
      label: { columns: { id: true, name: true, color: true } },
      labelAssignments: {
        columns: { position: true },
        orderBy: [asc(taskLabelAssignments.position)],
        with: {
          label: { columns: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const orderById = new Map(orderedTaskIds.map((taskId, index) => [taskId, index]));
  const archivedTasks = [...records]
    .sort(
      (left, right) =>
        (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((record) => toKanbanTask(record, 'archived'));

  return {
    tasks: archivedTasks,
    total,
    offset: normalizedOffset,
    limit: normalizedLimit,
    hasMore: normalizedOffset + normalizedLimit < total,
  };
}
