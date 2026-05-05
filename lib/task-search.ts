import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import type { DbClientOrTx } from '@/lib/db/types';

const DEFAULT_BOARD_SEARCH_LIMIT = 50;
const MAX_BOARD_SEARCH_LIMIT = 50;

export type TaskSearchResult = {
  taskId: string;
  score: number;
};

type SearchTasksForBoardParams = {
  ownerId: string;
  query: string;
  projectId?: string | null;
  limit?: number;
  client?: DbClientOrTx;
};

function clampBoardSearchLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_BOARD_SEARCH_LIMIT;
  const normalized = Math.trunc(limit as number);
  if (normalized < 1) return 1;
  return Math.min(normalized, MAX_BOARD_SEARCH_LIMIT);
}

function readSearchRows(result: unknown) {
  type SearchRow = { task_id: string; score: number | string };
  return Array.isArray(result)
    ? (result as SearchRow[])
    : Array.isArray((result as { rows?: SearchRow[] }).rows)
      ? (result as { rows: SearchRow[] }).rows
      : [];
}

function isMissingSearchFunctionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === '42883' || Boolean(maybeError.message?.includes('search_tasks_fts'));
}

async function fallbackSearchTasksForBoard({
  ownerId,
  query,
  projectId,
  limit,
  client,
}: Required<Pick<SearchTasksForBoardParams, 'ownerId' | 'query' | 'projectId' | 'client'>> & {
  limit: number;
}) {
  const pattern = `%${query}%`;
  const result = await client.execute<{ task_id: string; score: number | string }>(sql`
    select
      t.id as task_id,
      (
        case when t.task_key = ${query} then 100 else 0 end +
        case when t.task_key ilike ${pattern} then 40 else 0 end +
        case when t.title ilike ${pattern} then 30 else 0 end +
        case when coalesce(t.branch, '') ilike ${pattern} then 15 else 0 end +
        case when coalesce(t.note, '') ilike ${pattern} then 5 else 0 end
      ) as score
    from tasks t
    inner join projects p on p.id = t.project_id and p.deleted_at is null
    where t.owner_id = ${ownerId}
      and (${projectId}::uuid is null or t.project_id = ${projectId}::uuid)
      and (
        t.task_key ilike ${pattern}
        or t.title ilike ${pattern}
        or coalesce(t.branch, '') ilike ${pattern}
        or coalesce(t.note, '') ilike ${pattern}
      )
    order by score desc, t.updated_at desc
    limit ${limit}
  `);

  return readSearchRows(result);
}

async function hasSearchTasksFunction(client: DbClientOrTx) {
  const result = await client.execute<{ search_function: string | null }>(sql`
    select to_regprocedure('public.search_tasks_fts(uuid,text,uuid,integer)')::text as search_function
  `);
  const rows = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: { search_function: string | null }[] }).rows)
      ? (result as { rows: { search_function: string | null }[] }).rows
      : [];

  return Boolean(rows[0]?.search_function);
}

export async function searchTasksForBoard({
  ownerId,
  query,
  projectId = null,
  limit,
  client = db,
}: SearchTasksForBoardParams): Promise<TaskSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const normalizedLimit = clampBoardSearchLimit(limit);
  let rows;
  if (!(await hasSearchTasksFunction(client))) {
    rows = await fallbackSearchTasksForBoard({
      ownerId,
      query: trimmedQuery,
      projectId,
      limit: normalizedLimit,
      client,
    });
  } else {
    try {
      const result = await client.execute<{ task_id: string; score: number | string }>(sql`
        select task_id, score
        from search_tasks_fts(${ownerId}, ${trimmedQuery}, ${projectId}, ${normalizedLimit})
      `);
      rows = readSearchRows(result);
    } catch (error) {
      if (!isMissingSearchFunctionError(error)) throw error;
      rows = await fallbackSearchTasksForBoard({
        ownerId,
        query: trimmedQuery,
        projectId,
        limit: normalizedLimit,
        client,
      });
    }
  }

  return rows.map((row) => ({
    taskId: row.task_id,
    score: typeof row.score === 'number' ? row.score : Number(row.score),
  }));
}
