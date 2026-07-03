import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { taskComments, tasks, taskWorkNodes } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { normalizeEngineKey } from '@/lib/engine-icons';
import { ENTITY_TASK, TASK_UPDATED, writeOutboxEvent } from '@/lib/outbox';
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

function deriveTaskRunStateFromExecutionState(params: {
  commentRunStates: Array<string | null>;
  workNodeStatuses: Array<string | null>;
}): TaskRunState | null {
  if (
    params.commentRunStates.some((state) => state === 'working') ||
    params.workNodeStatuses.some((status) => status === 'running')
  ) {
    return 'running';
  }

  if (
    params.commentRunStates.some((state) => state === 'queued') ||
    params.workNodeStatuses.some((status) => status === 'ready')
  ) {
    return 'queued';
  }

  return null;
}

async function syncTaskRunState(params: {
  client: DbClientOrTx;
  ownerId: string;
  taskId: string;
  nextRunState: TaskRunState | null;
  now: Date;
}) {
  const task = await params.client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, params.ownerId), eq(tasks.id, params.taskId)),
    columns: { runState: true, taskKey: true, projectId: true },
  });

  if (!task || task.runState === params.nextRunState) return params.nextRunState;

  await params.client
    .update(tasks)
    .set(buildTaskRunStateUpdate(params.nextRunState, params.now))
    .where(and(eq(tasks.ownerId, params.ownerId), eq(tasks.id, params.taskId)));

  await writeOutboxEvent({
    tx: params.client,
    ownerId: params.ownerId,
    projectId: task.projectId,
    eventType: TASK_UPDATED,
    entityType: ENTITY_TASK,
    entityId: task.taskKey,
    payload: { changedFields: ['runState', 'runStateUpdatedAt'] },
  });

  return params.nextRunState;
}

export async function syncTaskRunStateFromWorkGraph({
  client,
  ownerId,
  taskId,
  now = new Date(),
}: {
  client: DbClientOrTx;
  ownerId: string;
  taskId: string;
  now?: Date;
}) {
  const activeNodes = await client.query.taskWorkNodes.findMany({
    where: and(
      eq(taskWorkNodes.ownerId, ownerId),
      eq(taskWorkNodes.taskId, taskId),
      inArray(taskWorkNodes.status, ['ready', 'running']),
    ),
    columns: { status: true },
  });

  return syncTaskRunState({
    client,
    ownerId,
    taskId,
    nextRunState: deriveTaskRunStateFromExecutionState({
      commentRunStates: [],
      workNodeStatuses: activeNodes.map((node) => node.status),
    }),
    now,
  });
}

export async function syncTaskRunStateFromExecutionState({
  client,
  ownerId,
  taskId,
  now = new Date(),
}: {
  client: DbClientOrTx;
  ownerId: string;
  taskId: string;
  now?: Date;
}) {
  const [activeComments, activeNodes] = await Promise.all([
    client.query.taskComments.findMany({
      where: and(
        eq(taskComments.ownerId, ownerId),
        eq(taskComments.taskId, taskId),
        inArray(taskComments.runState, ['queued', 'working']),
      ),
      columns: { runState: true },
    }),
    client.query.taskWorkNodes.findMany({
      where: and(
        eq(taskWorkNodes.ownerId, ownerId),
        eq(taskWorkNodes.taskId, taskId),
        inArray(taskWorkNodes.status, ['ready', 'running']),
      ),
      columns: { status: true },
    }),
  ]);

  return syncTaskRunState({
    client,
    ownerId,
    taskId,
    nextRunState: deriveTaskRunStateFromExecutionState({
      commentRunStates: activeComments.map((comment) => comment.runState),
      workNodeStatuses: activeNodes.map((node) => node.status),
    }),
    now,
  });
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
