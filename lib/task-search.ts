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
  const result = await client.execute<{ task_id: string; score: number | string }>(sql`
    select task_id, score
    from search_tasks_fts(${ownerId}, ${trimmedQuery}, ${projectId}, ${normalizedLimit})
  `);
  type SearchRow = { task_id: string; score: number | string };
  const rows = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: SearchRow[] }).rows)
      ? (result as { rows: SearchRow[] }).rows
      : [];

  return rows.map((row) => ({
    taskId: row.task_id,
    score: typeof row.score === 'number' ? row.score : Number(row.score),
  }));
}
