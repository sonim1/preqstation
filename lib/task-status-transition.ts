import { eq } from 'drizzle-orm';

import { tasks, workLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import {
  type KanbanStatus,
  type KanbanTask,
  type TaskForKanban,
  toKanbanTask,
} from '@/lib/kanban-helpers';
import { ENTITY_TASK, TASK_STATUS_CHANGED, writeOutboxEventStandalone } from '@/lib/outbox';
import { safeCreateTaskCompletionNotification } from '@/lib/task-notifications';
import { buildTaskStatusChangeWorkLog, type TaskFieldChange } from '@/lib/task-worklog';

type BoardTaskTransitionClient = Pick<DbClientOrTx, 'insert' | 'update'>;

type TransitionLabel = {
  id: string;
  name: string;
  color?: string | null;
};

export type BoardTaskTransitionExistingTask = TaskForKanban & {
  status: string;
  projectId: string | null;
};

export type BoardTaskTransitionNextTask = {
  title: string;
  note: string | null;
  status: KanbanStatus;
  sortOrder: string;
  taskPriority: string;
  dueAt: Date | null;
  labelId: string | null;
  labels: TransitionLabel[];
};

export async function applyBoardTaskStatusTransition(params: {
  tx: BoardTaskTransitionClient;
  ownerId: string;
  projectId: string | null;
  existingTask: BoardTaskTransitionExistingTask;
  nextTask: BoardTaskTransitionNextTask;
  extraChanges?: TaskFieldChange[];
  now?: Date;
}): Promise<KanbanTask> {
  const now = params.now ?? new Date();
  const normalizedLabels = params.nextTask.labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color ?? 'blue',
  }));
  const nextArchivedAt =
    params.nextTask.status === 'archived'
      ? now
      : params.existingTask.status === 'archived'
        ? null
        : params.existingTask.archivedAt;

  await params.tx
    .update(tasks)
    .set({
      title: params.nextTask.title,
      note: params.nextTask.note,
      status: params.nextTask.status,
      sortOrder: params.nextTask.sortOrder,
      taskPriority: params.nextTask.taskPriority,
      dueAt: params.nextTask.dueAt,
      labelId: params.nextTask.labelId,
      engine: null,
      archivedAt: nextArchivedAt,
      updatedAt: now,
      runState: null,
      runStateUpdatedAt: null,
    })
    .where(eq(tasks.id, params.existingTask.id));

  const statusLog = buildTaskStatusChangeWorkLog({
    taskKey: params.existingTask.taskKey,
    taskTitle: params.nextTask.title,
    fromStatus: params.existingTask.status,
    toStatus: params.nextTask.status,
    extraChanges: params.extraChanges,
  });

  await params.tx.insert(workLogs).values({
    ownerId: params.ownerId,
    projectId: params.projectId,
    taskId: params.existingTask.id,
    title: statusLog.title,
    detail: statusLog.detail,
    engine: null,
    workedAt: now,
  });

  await safeCreateTaskCompletionNotification({
    tx: params.tx as DbClientOrTx,
    ownerId: params.ownerId,
    projectId: params.projectId,
    taskId: params.existingTask.id,
    taskKey: params.existingTask.taskKey,
    taskTitle: params.nextTask.title,
    fromStatus: params.existingTask.status,
    toStatus: params.nextTask.status,
    previousRunState: params.existingTask.runState,
    nextRunState: null,
  });

  await writeOutboxEventStandalone(
    {
      ownerId: params.ownerId,
      projectId: params.projectId,
      eventType: TASK_STATUS_CHANGED,
      entityType: ENTITY_TASK,
      entityId: params.existingTask.taskKey,
      payload: { from: params.existingTask.status, to: params.nextTask.status },
    },
    params.tx as DbClientOrTx,
  );

  return toKanbanTask(
    {
      ...params.existingTask,
      title: params.nextTask.title,
      note: params.nextTask.note,
      sortOrder: params.nextTask.sortOrder,
      taskPriority: params.nextTask.taskPriority,
      dueAt: params.nextTask.dueAt,
      engine: null,
      runState: null,
      runStateUpdatedAt: null,
      archivedAt: nextArchivedAt,
      updatedAt: now,
      labels: normalizedLabels,
    },
    params.nextTask.status,
  );
}
