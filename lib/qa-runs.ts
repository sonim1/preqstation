import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { qaRuns } from '@/lib/db/schema';
import type { DbClientOrTx, SelectQaRun } from '@/lib/db/types';

export const QA_RUN_STATUSES = ['queued', 'running', 'passed', 'failed'] as const;
export type QaRunStatus = (typeof QA_RUN_STATUSES)[number];
export const QA_RUNS_STORAGE_UNAVAILABLE_MESSAGE =
  'QA runs are unavailable until qa_runs migration is applied';

export type QaRunSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type QaRunView = {
  id: string;
  projectId: string;
  branchName: string;
  status: QaRunStatus;
  engine: string | null;
  targetUrl: string | null;
  taskKeys: string[];
  summary: QaRunSummary;
  reportMarkdown: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export const EMPTY_QA_SUMMARY: QaRunSummary = {
  total: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
};

function toCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

export function normalizeQaSummary(summary: unknown): QaRunSummary {
  if (!summary || typeof summary !== 'object') return { ...EMPTY_QA_SUMMARY };

  const value = summary as Record<string, unknown>;
  return {
    total: toCount(value.total),
    critical: toCount(value.critical),
    high: toCount(value.high),
    medium: toCount(value.medium),
    low: toCount(value.low),
  };
}

export function serializeQaRun(record: SelectQaRun): QaRunView {
  return {
    id: record.id,
    projectId: record.projectId,
    branchName: record.branchName,
    status: (record.status as QaRunStatus) || 'queued',
    engine: record.engine ?? null,
    targetUrl: record.targetUrl ?? null,
    taskKeys: Array.isArray(record.taskKeys) ? record.taskKeys : [],
    summary: normalizeQaSummary(record.summary),
    reportMarkdown: record.reportMarkdown ?? null,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
  };
}

export async function createQueuedQaRun(
  params: {
    ownerId: string;
    projectId: string;
    branchName: string;
    engine?: string | null;
    taskKeys: string[];
  },
  client: DbClientOrTx = db,
) {
  const [run] = await client
    .insert(qaRuns)
    .values({
      ownerId: params.ownerId,
      projectId: params.projectId,
      branchName: params.branchName,
      status: 'queued',
      engine: params.engine ?? null,
      taskKeys: params.taskKeys,
      summary: EMPTY_QA_SUMMARY,
    })
    .returning();

  return serializeQaRun(run);
}

export async function deleteQaRun(id: string, ownerId: string, client: DbClientOrTx = db) {
  await client.delete(qaRuns).where(and(eq(qaRuns.id, id), eq(qaRuns.ownerId, ownerId)));
}

export function isMissingQaRunsRelationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('qa_runs') && message.includes('does not exist');
}

export async function qaRunsStorageAvailable(client: DbClientOrTx = db) {
  try {
    const result = await client.execute(sql`select to_regclass('public.qa_runs') as relation_name`);
    const rows = Array.isArray(result)
      ? result
      : Array.isArray((result as { rows?: unknown[] }).rows)
        ? (result as { rows: unknown[] }).rows
        : [];
    const firstRow = rows[0] ?? null;
    if (!firstRow || typeof firstRow !== 'object') return true;

    const relationName =
      (firstRow as Record<string, unknown>).relation_name ??
      (firstRow as Record<string, unknown>).relationName;

    return relationName === 'qa_runs' || relationName === 'public.qa_runs';
  } catch (error) {
    console.error('[qa-runs] failed to inspect qa_runs relation:', error);
    return true;
  }
}

export async function listProjectQaRuns(projectId: string, limit = 10, client: DbClientOrTx = db) {
  const qaQuery = (
    client.query as
      | {
          qaRuns?: { findMany?: typeof db.query.qaRuns.findMany };
        }
      | undefined
  )?.qaRuns;
  if (!qaQuery?.findMany) return [];
  if (!(await qaRunsStorageAvailable(client))) return [];

  try {
    const runs = await qaQuery.findMany({
      where: eq(qaRuns.projectId, projectId),
      orderBy: [desc(qaRuns.createdAt)],
      limit,
    });

    return runs.map(serializeQaRun);
  } catch (error) {
    console.error('[qa-runs] failed to load project QA runs, using empty state:', error);
    return [];
  }
}

export async function updateQaRun(
  params: {
    id: string;
    ownerId: string;
    status?: QaRunStatus;
    targetUrl?: string | null;
    reportMarkdown?: string | null;
    summary?: QaRunSummary;
  },
  client: DbClientOrTx = db,
) {
  const existing = await client.query.qaRuns.findFirst({
    where: and(eq(qaRuns.id, params.id), eq(qaRuns.ownerId, params.ownerId)),
  });
  if (!existing) return null;

  const now = new Date();
  const nextStatus = params.status ?? ((existing.status as QaRunStatus) || 'queued');
  const nextStartedAt =
    nextStatus === 'running'
      ? (existing.startedAt ?? now)
      : nextStatus === 'passed' || nextStatus === 'failed'
        ? (existing.startedAt ?? now)
        : existing.startedAt;
  const nextFinishedAt =
    nextStatus === 'passed' || nextStatus === 'failed'
      ? now
      : nextStatus === 'running'
        ? null
        : existing.finishedAt;

  const [updated] = await client
    .update(qaRuns)
    .set({
      status: nextStatus,
      targetUrl: params.targetUrl === undefined ? existing.targetUrl : params.targetUrl,
      reportMarkdown:
        params.reportMarkdown === undefined ? existing.reportMarkdown : params.reportMarkdown,
      summary: params.summary ?? normalizeQaSummary(existing.summary),
      startedAt: nextStartedAt,
      finishedAt: nextFinishedAt,
    })
    .where(and(eq(qaRuns.id, params.id), eq(qaRuns.ownerId, params.ownerId)))
    .returning();

  return serializeQaRun(updated);
}
