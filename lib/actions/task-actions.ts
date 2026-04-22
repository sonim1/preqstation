import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, gte, like } from 'drizzle-orm';

import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, tasks, workLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { stripPreqChoiceBlocks } from '@/lib/markdown';
import {
  ENTITY_TASK,
  TASK_CREATED,
  TASK_DELETED,
  TASK_STATUS_CHANGED,
  TASK_UPDATED,
  writeOutboxEvent,
} from '@/lib/outbox';
import { generateBranchName } from '@/lib/preq-task';
import {
  isTaskKeyUniqueConstraintError,
  isUuidIdentifier,
  normalizeTaskIdentifier,
  resolveNextTaskKey,
  taskWhereByIdentifier,
} from '@/lib/task-keys';
import {
  extractTaskLabels,
  normalizeTaskLabelIds,
  resolveProjectTaskLabels,
  summarizeTaskLabelNames,
  syncTaskLabelAssignments,
} from '@/lib/task-labels';
import {
  coerceTaskRunState,
  isTaskStatus,
  parseTaskPriority,
  taskRunStateLabel,
} from '@/lib/task-meta';
import { createTaskCompletionNotification } from '@/lib/task-notifications';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import { resolveAppendSortOrder } from '@/lib/task-sort-order';
import {
  addTaskFieldChange,
  buildTaskFieldChangeWorkLog,
  buildTaskNoteChangeDetail,
  buildTaskStatusChangeWorkLog,
  mergeFieldChanges,
  parseFieldChangesFromDetail,
  rebuildWorkLogFromChanges,
  taskPriorityLabel,
} from '@/lib/task-worklog';
import { resolveTerminology } from '@/lib/terminology';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

type TaskActionErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'UNEXPECTED';

type TaskActionSuccess<T> = {
  ok: true;
  data: T;
};

type TaskActionFailure = {
  ok: false;
  code: TaskActionErrorCode;
  message: string;
};

export type TaskActionResult<T> = TaskActionSuccess<T> | TaskActionFailure;

export type CreateTaskParams = {
  ownerId: string;
  title: string;
  contentMd?: string | null;
  projectId: string;
  labelIds?: string[] | null;
  taskPriority?: string | null;
};

export type CreateTaskData = {
  id: string;
  taskKey: string;
  projectId: string;
  labelId: string | null;
  labelIds: string[];
  taskPriority: string;
};

export type UpdateTaskStatusParams = {
  ownerId: string;
  identifier: string;
  status: string;
  projectId?: string | null;
};

export type UpdateTaskStatusData = {
  id: string;
  taskKey: string;
  projectId: string | null;
  fromStatus: string;
  status: string;
  changed: boolean;
};

export type UpdateTaskParams = {
  ownerId: string;
  identifier: string;
  title: string;
  noteMd?: string | null;
  labelIds?: string[] | null;
  taskPriority?: string | null;
  runState?: string | null;
  projectId?: string | null;
};

export type UpdateTaskData = {
  id: string;
  taskKey: string;
  projectId: string | null;
  labelId: string | null;
  labelIds: string[];
  taskPriority: string;
  changed: boolean;
  changedFields: string[];
};

export type DeleteTaskParams = {
  ownerId: string;
  identifier: string;
  projectId?: string | null;
};

export type DeleteTaskData = {
  id: string;
  taskKey: string;
  projectId: string | null;
};

function ok<T>(data: T): TaskActionResult<T> {
  return { ok: true, data };
}

function fail<T>(code: TaskActionErrorCode, message: string): TaskActionResult<T> {
  return { ok: false, code, message };
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim();
}

async function getOwnerTerminology(ownerId: string, client: DbClientOrTx) {
  const kitchenMode = await getUserSetting(ownerId, SETTING_KEYS.KITCHEN_MODE, client);
  return resolveTerminology(kitchenMode === 'true');
}

function invalidTaskLabelMessage(labelIds: string[]) {
  return labelIds.length > 1 ? 'Invalid labelIds.' : 'Invalid labelId.';
}

function missingTaskLabelMessage(labelIds: string[]) {
  return labelIds.length > 1 ? 'One or more labels not found.' : 'Label not found.';
}

function resolveTaskWhere(params: {
  ownerId: string;
  identifier: string;
  projectId?: string | null;
}): TaskActionResult<{ where: SQL }> {
  const identifier = normalizeTaskIdentifier(params.identifier);
  if (!identifier) {
    return fail('INVALID_INPUT', 'Task identifier is required.');
  }

  const projectId = normalizeText(params.projectId);
  if (projectId && !isUuidIdentifier(projectId)) {
    return fail('INVALID_INPUT', 'Invalid projectId.');
  }

  let where: SQL = taskWhereByIdentifier(params.ownerId, identifier);
  if (projectId) {
    where = and(where, eq(tasks.projectId, projectId))!;
  }

  return ok({ where });
}

export async function createTask(
  params: CreateTaskParams,
): Promise<TaskActionResult<CreateTaskData>> {
  const title = normalizeText(params.title);
  if (!title) {
    return fail('INVALID_INPUT', 'Title is required.');
  }

  const projectIdRaw = normalizeText(params.projectId);
  if (!isUuidIdentifier(projectIdRaw)) {
    return fail('INVALID_INPUT', 'Invalid projectId.');
  }

  try {
    return await withOwnerDb(params.ownerId, async (client) => {
      const project = await client.query.projects.findFirst({
        where: (projects, { and, eq, isNull }) =>
          and(
            eq(projects.id, projectIdRaw),
            eq(projects.ownerId, params.ownerId),
            isNull(projects.deletedAt),
          ),
        columns: { id: true, projectKey: true },
      });
      if (!project) {
        return fail('NOT_FOUND', 'Project not found.');
      }

      const requestedLabelIds = normalizeTaskLabelIds(params.labelIds);
      if (requestedLabelIds.some((labelId) => !isUuidIdentifier(labelId))) {
        return fail('INVALID_INPUT', invalidTaskLabelMessage(requestedLabelIds));
      }
      const resolvedLabels = await resolveProjectTaskLabels(
        params.ownerId,
        project.id,
        requestedLabelIds,
        client,
      );
      if (resolvedLabels.length !== requestedLabelIds.length) {
        return fail('NOT_FOUND', missingTaskLabelMessage(requestedLabelIds));
      }
      const labelIds = resolvedLabels.map((label) => label.id);
      const primaryLabelId = labelIds[0] ?? null;

      const taskPriority = parseTaskPriority(params.taskPriority);
      const contentMd = normalizeText(stripPreqChoiceBlocks(params.contentMd));
      const taskKeyParts = await resolveNextTaskKey({
        ownerId: params.ownerId,
        taskPrefix: project.projectKey,
        db: client,
      });
      const branch = generateBranchName(taskKeyParts.taskKey, title);
      const sortOrder = await resolveAppendSortOrder({
        client,
        ownerId: params.ownerId,
        status: 'inbox',
      });

      const [task] = await client
        .insert(tasks)
        .values({
          ownerId: params.ownerId,
          taskKey: taskKeyParts.taskKey,
          taskPrefix: taskKeyParts.taskPrefix,
          taskNumber: taskKeyParts.taskNumber,
          title,
          note: contentMd || null,
          projectId: project.id,
          labelId: primaryLabelId,
          branch,
          status: 'inbox',
          sortOrder,
          taskPriority,
        })
        .returning();

      await syncTaskLabelAssignments(client, task.id, labelIds);

      await writeOutboxEvent({
        tx: client,
        ownerId: params.ownerId,
        projectId: project.id,
        eventType: TASK_CREATED,
        entityType: ENTITY_TASK,
        entityId: task.taskKey,
        payload: { title, status: 'inbox' },
      });

      return ok({
        id: task.id,
        taskKey: task.taskKey,
        projectId: task.projectId ?? project.id,
        labelId: task.labelId,
        labelIds,
        taskPriority: task.taskPriority,
      });
    });
  } catch (error) {
    if (isTaskKeyUniqueConstraintError(error)) {
      return fail('CONFLICT', 'Task key already exists.');
    }
    return fail('UNEXPECTED', 'Failed to create task.');
  }
}

export async function updateTaskStatus(
  params: UpdateTaskStatusParams,
): Promise<TaskActionResult<UpdateTaskStatusData>> {
  const status = normalizeText(params.status);
  if (!isTaskStatus(status)) {
    return fail('INVALID_INPUT', 'Invalid status.');
  }

  const whereResult = resolveTaskWhere({
    ownerId: params.ownerId,
    identifier: params.identifier,
    projectId: params.projectId,
  });
  if (!whereResult.ok) return whereResult;

  try {
    return await withOwnerDb(params.ownerId, async (client) => {
      const [existing, terminology] = await Promise.all([
        client.query.tasks.findFirst({
          where: whereResult.data.where,
          columns: {
            id: true,
            taskKey: true,
            title: true,
            engine: true,
            runState: true,
            status: true,
            projectId: true,
          },
        }),
        getOwnerTerminology(params.ownerId, client),
      ]);
      if (!existing) {
        return fail('NOT_FOUND', 'Task not found.');
      }

      if (existing.status === status) {
        return ok({
          id: existing.id,
          taskKey: existing.taskKey,
          projectId: existing.projectId,
          fromStatus: existing.status,
          status,
          changed: false,
        });
      }

      const statusLog = buildTaskStatusChangeWorkLog({
        taskKey: existing.taskKey,
        taskTitle: existing.title,
        fromStatus: existing.status,
        toStatus: status,
        terminology,
      });

      await client
        .update(tasks)
        .set({
          status,
          engine: null,
          ...(status === 'archived'
            ? { archivedAt: new Date() }
            : existing.status === 'archived'
              ? { archivedAt: null }
              : {}),
        })
        .where(eq(tasks.id, existing.id));

      await client.insert(workLogs).values({
        ownerId: params.ownerId,
        projectId: existing.projectId,
        taskId: existing.id,
        title: statusLog.title,
        detail: statusLog.detail,
        engine: null,
        workedAt: new Date(),
      });

      await createTaskCompletionNotification({
        tx: client,
        ownerId: params.ownerId,
        projectId: existing.projectId,
        taskId: existing.id,
        taskKey: existing.taskKey,
        taskTitle: existing.title,
        fromStatus: existing.status,
        toStatus: status,
        previousRunState: existing.runState,
      });

      await writeOutboxEvent({
        tx: client,
        ownerId: params.ownerId,
        projectId: existing.projectId,
        eventType: TASK_STATUS_CHANGED,
        entityType: ENTITY_TASK,
        entityId: existing.taskKey,
        payload: { from: existing.status, to: status },
      });

      return ok({
        id: existing.id,
        taskKey: existing.taskKey,
        projectId: existing.projectId,
        fromStatus: existing.status,
        status,
        changed: true,
      });
    });
  } catch {
    return fail('UNEXPECTED', 'Failed to update task status.');
  }
}

export async function updateTask(
  params: UpdateTaskParams,
): Promise<TaskActionResult<UpdateTaskData>> {
  const title = normalizeText(params.title);
  if (!title) {
    return fail('INVALID_INPUT', 'Title is required.');
  }

  const whereResult = resolveTaskWhere({
    ownerId: params.ownerId,
    identifier: params.identifier,
    projectId: params.projectId,
  });
  if (!whereResult.ok) return whereResult;

  try {
    return await withOwnerDb(params.ownerId, async (client) => {
      const [existing, terminology] = await Promise.all([
        client.query.tasks.findFirst({
          where: whereResult.data.where,
          columns: {
            id: true,
            taskKey: true,
            title: true,
            note: true,
            projectId: true,
            engine: true,
            labelId: true,
            taskPriority: true,
            runState: true,
          },
          with: {
            label: { columns: { id: true, name: true, color: true } },
            labelAssignments: {
              columns: { position: true },
              orderBy: [asc(taskLabelAssignments.position)],
              with: {
                label: { columns: { id: true, name: true, color: true } },
              },
            },
          },
        }),
        getOwnerTerminology(params.ownerId, client),
      ]);
      if (!existing) {
        return fail('NOT_FOUND', 'Task not found.');
      }

      const existingLabels = extractTaskLabels(existing);
      const requestedLabelIds =
        params.labelIds !== undefined ? normalizeTaskLabelIds(params.labelIds) : undefined;
      if (requestedLabelIds && requestedLabelIds.some((labelId) => !isUuidIdentifier(labelId))) {
        return fail('INVALID_INPUT', invalidTaskLabelMessage(requestedLabelIds));
      }
      const resolvedLabels =
        requestedLabelIds === undefined
          ? existingLabels
          : await resolveProjectTaskLabels(
              params.ownerId,
              existing.projectId,
              requestedLabelIds,
              client,
            );
      if (requestedLabelIds && resolvedLabels.length !== requestedLabelIds.length) {
        return fail('NOT_FOUND', missingTaskLabelMessage(requestedLabelIds));
      }
      const nextLabelIds = resolvedLabels.map((label) => label.id);
      const labelId = nextLabelIds[0] ?? null;

      const noteMd = normalizeText(stripPreqChoiceBlocks(params.noteMd));
      const taskPriority = parseTaskPriority(params.taskPriority);
      const runState =
        params.runState === undefined ? undefined : coerceTaskRunState(params.runState);
      const changes: Array<{ field: string; from: string; to: string }> = [];
      addTaskFieldChange(changes, 'Title', existing.title, title);
      addTaskFieldChange(
        changes,
        'Task Priority',
        taskPriorityLabel(existing.taskPriority),
        taskPriorityLabel(taskPriority),
      );
      addTaskFieldChange(
        changes,
        'Labels',
        summarizeTaskLabelNames(existingLabels),
        summarizeTaskLabelNames(resolvedLabels),
      );
      if (params.runState !== undefined) {
        addTaskFieldChange(
          changes,
          'Run State',
          taskRunStateLabel(existing.runState),
          taskRunStateLabel(runState),
        );
      }
      const existingNote = normalizeText(existing.note);
      const noteChangeDetail =
        existingNote !== noteMd
          ? buildTaskNoteChangeDetail({
              taskKey: existing.taskKey,
              taskTitle: title,
              previousNote: existingNote,
              updatedNote: noteMd,
            })
          : null;
      if (existingNote !== noteMd) {
        changes.push({
          field: 'Note',
          from: existingNote ? 'set' : 'empty',
          to: noteMd ? 'set' : 'empty',
        });
      }

      if (changes.length === 0) {
        return ok({
          id: existing.id,
          taskKey: existing.taskKey,
          projectId: existing.projectId,
          labelId: requestedLabelIds === undefined ? existing.labelId : labelId,
          labelIds:
            requestedLabelIds === undefined
              ? existingLabels.map((label) => label.id)
              : nextLabelIds,
          taskPriority,
          changed: false,
          changedFields: [],
        });
      }

      const changedFields = changes.map((change) => change.field);
      const fieldLogChanges = changes.filter((change) => change.field !== 'Note');
      const shouldClearEngine = changedFields.some((field) => field !== 'Run State');
      const shouldWriteFieldWorkLog = fieldLogChanges.length > 0;
      const MERGE_WINDOW_MS = 5 * 60 * 1000;

      await client
        .update(tasks)
        .set({
          title,
          note: noteMd || null,
          labelId: requestedLabelIds === undefined ? existing.labelId : labelId,
          taskPriority,
          ...(params.runState !== undefined ? buildTaskRunStateUpdate(runState ?? null) : {}),
          ...(shouldClearEngine ? { engine: null } : {}),
        })
        .where(eq(tasks.id, existing.id));

      if (requestedLabelIds !== undefined) {
        await syncTaskLabelAssignments(client, existing.id, nextLabelIds);
      }

      if (shouldWriteFieldWorkLog) {
        const recentLog = await client.query.workLogs.findFirst({
          where: and(
            eq(workLogs.taskId, existing.id),
            like(workLogs.title, '%Fields Updated%'),
            gte(workLogs.workedAt, new Date(Date.now() - MERGE_WINDOW_MS)),
          ),
          orderBy: desc(workLogs.workedAt),
        });

        if (recentLog) {
          const existingChanges = parseFieldChangesFromDetail(recentLog.detail ?? '');
          if (existingChanges) {
            const merged = mergeFieldChanges(existingChanges, fieldLogChanges);
            const rebuilt = rebuildWorkLogFromChanges(existing.taskKey, title, merged, terminology);
            if (rebuilt) {
              await client
                .update(workLogs)
                .set({
                  title: rebuilt.title,
                  detail: rebuilt.detail,
                  engine: null,
                  workedAt: new Date(),
                })
                .where(eq(workLogs.id, recentLog.id));
            } else {
              await client.delete(workLogs).where(eq(workLogs.id, recentLog.id));
            }
          } else {
            const fieldLog = buildTaskFieldChangeWorkLog({
              taskKey: existing.taskKey,
              taskTitle: title,
              changes: fieldLogChanges,
              terminology,
            });
            if (fieldLog) {
              await client.insert(workLogs).values({
                ownerId: params.ownerId,
                projectId: existing.projectId,
                taskId: existing.id,
                title: fieldLog.title,
                detail: fieldLog.detail,
                engine: null,
                workedAt: new Date(),
              });
            }
          }
        } else {
          const fieldLog = buildTaskFieldChangeWorkLog({
            taskKey: existing.taskKey,
            taskTitle: title,
            changes: fieldLogChanges,
            terminology,
          });
          if (fieldLog) {
            await client.insert(workLogs).values({
              ownerId: params.ownerId,
              projectId: existing.projectId,
              taskId: existing.id,
              title: fieldLog.title,
              detail: fieldLog.detail,
              engine: null,
              workedAt: new Date(),
            });
          }
        }
      }

      if (noteChangeDetail) {
        await client.insert(workLogs).values({
          ownerId: params.ownerId,
          projectId: existing.projectId,
          taskId: existing.id,
          title: `${existing.taskKey} · Note Updated`,
          detail: noteChangeDetail,
          engine: null,
          workedAt: new Date(),
        });
      }

      await writeOutboxEvent({
        tx: client,
        ownerId: params.ownerId,
        projectId: existing.projectId,
        eventType: TASK_UPDATED,
        entityType: ENTITY_TASK,
        entityId: existing.taskKey,
        payload: { changedFields },
      });

      return ok({
        id: existing.id,
        taskKey: existing.taskKey,
        projectId: existing.projectId,
        labelId,
        labelIds: nextLabelIds,
        taskPriority,
        changed: true,
        changedFields,
      });
    });
  } catch (error) {
    if (isTaskKeyUniqueConstraintError(error)) {
      return fail('CONFLICT', 'Task key already exists.');
    }
    return fail('UNEXPECTED', 'Failed to update task.');
  }
}

export async function deleteTask(
  params: DeleteTaskParams,
): Promise<TaskActionResult<DeleteTaskData>> {
  const whereResult = resolveTaskWhere({
    ownerId: params.ownerId,
    identifier: params.identifier,
    projectId: params.projectId,
  });
  if (!whereResult.ok) return whereResult;

  try {
    return await withOwnerDb(params.ownerId, async (client) => {
      const existing = await client.query.tasks.findFirst({
        where: whereResult.data.where,
        columns: { id: true, taskKey: true, projectId: true },
      });
      if (!existing) {
        return fail('NOT_FOUND', 'Task not found.');
      }

      await client.delete(tasks).where(eq(tasks.id, existing.id));

      await writeOutboxEvent({
        tx: client,
        ownerId: params.ownerId,
        projectId: existing.projectId,
        eventType: TASK_DELETED,
        entityType: ENTITY_TASK,
        entityId: existing.taskKey,
      });

      return ok({
        id: existing.id,
        taskKey: existing.taskKey,
        projectId: existing.projectId,
      });
    });
  } catch {
    return fail('UNEXPECTED', 'Failed to delete task.');
  }
}
