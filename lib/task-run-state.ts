import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { normalizeEngineKey } from '@/lib/engine-icons';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import type { TaskRunState } from '@/lib/task-meta';

export function buildTaskRunStateUpdate(
  runState: TaskRunState | null,
  now: Date = new Date(),
): { runState: TaskRunState | null; runStateUpdatedAt: Date | null } {
  return {
    runState,
    runStateUpdatedAt: runState ? now : null,
  };
}

export async function findTaskDispatchContextByTaskKey(
  params: {
    ownerId: string;
    taskKey: string;
  },
  client: DbClientOrTx = db,
) {
  const task = await client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, params.ownerId), eq(tasks.taskKey, params.taskKey)),
    columns: {
      taskKey: true,
      projectId: true,
    },
  });

  return task ?? null;
}

export async function queueTaskExecutionByTaskKey(
  params: {
    ownerId: string;
    taskKey: string;
    dispatchTarget?: string | null;
    engine?: string | null;
    branch?: string | null;
    now?: Date;
  },
  client: DbClientOrTx = db,
) {
  const now = params.now ?? new Date();
  const dispatchTarget = normalizeTaskDispatchTarget(params.dispatchTarget);
  const engine = normalizeEngineKey(params.engine) ?? null;
  const branch = params.branch?.trim() || null;
  const [queuedTask] = await client
    .update(tasks)
    .set({
      archivedAt: null,
      dispatchTarget,
      ...(engine ? { engine } : {}),
      ...(branch ? { branch } : {}),
      ...buildTaskRunStateUpdate('queued', now),
    })
    .where(and(eq(tasks.ownerId, params.ownerId), eq(tasks.taskKey, params.taskKey)))
    .returning({
      taskKey: tasks.taskKey,
      projectId: tasks.projectId,
    });

  return queuedTask ?? null;
}
