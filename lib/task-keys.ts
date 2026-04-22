import type { SQL } from 'drizzle-orm';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

const TASK_KEY_PATTERN = /^([A-Z0-9]{1,10})-([1-9]\d{0,8})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TaskKeyParts = {
  taskKey: string;
  taskPrefix: string;
  taskNumber: number;
};

export class TaskKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskKeyValidationError';
  }
}

function sanitizeTaskPrefix(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function normalizeTaskPrefix(value: string | null | undefined, fallback = 'TASK') {
  const normalized = sanitizeTaskPrefix(value || '');
  if (normalized) return normalized;
  return sanitizeTaskPrefix(fallback) || 'TASK';
}

export function parseTaskKey(value: string | null | undefined) {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) return null;

  const matched = normalized.match(TASK_KEY_PATTERN);
  if (!matched) return null;

  const taskPrefix = normalizeTaskPrefix(matched[1]);
  const taskNumber = Number(matched[2]);

  if (!Number.isInteger(taskNumber) || taskNumber < 1) {
    return null;
  }

  return {
    taskPrefix,
    taskNumber,
    taskKey: `${taskPrefix}-${taskNumber}`,
  } satisfies TaskKeyParts;
}

export async function resolveNextTaskKey(params: {
  ownerId: string;
  taskPrefix: string;
  db?: DbClientOrTx;
}): Promise<TaskKeyParts> {
  const client = params.db ?? db;
  const taskPrefix = normalizeTaskPrefix(params.taskPrefix, 'TASK');

  const latest = await client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, params.ownerId), eq(tasks.taskPrefix, taskPrefix)),
    orderBy: desc(tasks.taskNumber),
    columns: { taskNumber: true },
  });

  const taskNumber = (latest?.taskNumber ?? 0) + 1;
  return {
    taskPrefix,
    taskNumber,
    taskKey: `${taskPrefix}-${taskNumber}`,
  };
}

export function isUuidIdentifier(value: string | null | undefined) {
  return UUID_PATTERN.test((value || '').trim());
}

export function normalizeTaskIdentifier(value: string | null | undefined) {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  if (isUuidIdentifier(normalized)) return normalized;

  const parsed = parseTaskKey(normalized);
  return parsed ? parsed.taskKey : normalized.toUpperCase();
}

export function taskWhereByIdentifier(ownerId: string, identifier: string): SQL {
  const normalized = normalizeTaskIdentifier(identifier);
  if (isUuidIdentifier(normalized)) {
    return and(eq(tasks.ownerId, ownerId), eq(tasks.id, normalized))!;
  }

  return and(eq(tasks.ownerId, ownerId), eq(tasks.taskKey, normalized))!;
}

export function isTaskKeyUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';
  if (!/unique constraint|duplicate key|already exists/i.test(message)) return false;

  const matchesTaskKey = /task_key|tasks_owner_id_task_key_idx?/i.test(message);
  const matchesTaskSequence =
    /tasks_owner_id_task_prefix_task_number_unique_idx|task_prefix.*task_number|task_number.*task_prefix/i.test(
      message,
    );

  return matchesTaskKey || matchesTaskSequence;
}
