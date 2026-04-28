'use server';

import { asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import {
  deleteTask as runDeleteTaskAction,
  updateTask as runUpdateTaskAction,
} from '@/lib/actions/task-actions';
import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, workLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { type KanbanTask, toKanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { isNextRedirectError } from '@/lib/next-utils';
import { requireOwnerUser } from '@/lib/owner';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import { taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels, getTaskLabelIdsFromFormData } from '@/lib/task-labels';
import { coerceTaskRunState } from '@/lib/task-meta';

type ActionState =
  | { ok: true; boardTask: KanbanTask; focusedTask: EditableBoardTask }
  | { ok: false; message: string };

async function loadBoardTask(ownerId: string, identifier: string, client: DbClientOrTx) {
  return client.query.tasks.findFirst({
    where: taskWhereByIdentifier(ownerId, identifier),
    columns: {
      id: true,
      taskKey: true,
      branch: true,
      title: true,
      note: true,
      projectId: true,
      taskPriority: true,
      status: true,
      engine: true,
      dispatchTarget: true,
      runState: true,
      runStateUpdatedAt: true,
      sortOrder: true,
      dueAt: true,
      archivedAt: true,
      updatedAt: true,
    },
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
      workLogs: {
        orderBy: [asc(workLogs.workedAt)],
        columns: {
          id: true,
          title: true,
          engine: true,
          workedAt: true,
          createdAt: true,
        },
        with: {
          task: { columns: { engine: true } },
        },
      },
    },
  });
}

function toEditableBoardTask(task: NonNullable<Awaited<ReturnType<typeof loadBoardTask>>>) {
  const labels = extractTaskLabels(task);

  return {
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    branch: task.branch,
    note: task.note,
    projectId: task.projectId,
    labelIds: labels.map((label) => label.id),
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
    })),
    taskPriority: task.taskPriority,
    status: task.status,
    engine: task.engine,
    dispatchTarget: normalizeTaskDispatchTarget(task.dispatchTarget),
    runState: coerceTaskRunState(task.runState),
    runStateUpdatedAt: task.runStateUpdatedAt ? task.runStateUpdatedAt.toISOString() : null,
    workLogs: task.workLogs.map((log) => ({
      id: log.id,
      title: log.title,
      engine: log.engine,
      workedAt: log.workedAt,
      createdAt: log.createdAt,
      todo: log.task ? { engine: log.task.engine } : null,
    })),
  };
}

export async function boardUpdateTask(
  _prevState: unknown,
  formData: FormData,
  _boardHref: string,
  fixedProjectId?: string,
): Promise<ActionState> {
  try {
    const ownerUser = await requireOwnerUser();
    const result = await runUpdateTaskAction({
      ownerId: ownerUser.id,
      identifier: String(formData.get('id') || ''),
      baseNoteFingerprint: String(formData.get('baseNoteFingerprint') || ''),
      title: String(formData.get('title') || ''),
      noteMd: String(formData.get('noteMd') || ''),
      labelIds: getTaskLabelIdsFromFormData(formData),
      taskPriority: String(formData.get('taskPriority') || ''),
      runState: String(formData.get('runState') || ''),
      projectId: fixedProjectId ?? String(formData.get('projectId') || ''),
    });
    if (!result.ok) {
      return { ok: false, message: result.message ?? 'Failed to update task.' };
    }

    if (result.data.changed) {
      await writeAuditLog({
        ownerId: ownerUser.id,
        action: 'task.updated',
        targetType: 'task',
        targetId: result.data.taskKey,
        meta: {
          labelId: result.data.labelId,
          labelIds: result.data.labelIds,
          taskPriority: result.data.taskPriority,
          changedFields: result.data.changedFields,
        },
      });
    }

    const updatedTask = await withOwnerDb(ownerUser.id, async (client) =>
      loadBoardTask(ownerUser.id, result.data.taskKey, client),
    );
    if (!updatedTask) {
      return { ok: false, message: 'Updated task could not be reloaded.' };
    }

    return {
      ok: true,
      boardTask: toKanbanTask(
        updatedTask,
        updatedTask.status as Parameters<typeof toKanbanTask>[1],
      ),
      focusedTask: toEditableBoardTask(updatedTask),
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('[updateTask] failed:', error);
    return { ok: false, message: 'An error occurred while updating the task.' };
  }
}

export async function boardDeleteTask(
  _prevState: unknown,
  formData: FormData,
  boardHref: string,
  fixedProjectId?: string,
): Promise<ActionState> {
  const ownerUser = await requireOwnerUser();
  const result = await runDeleteTaskAction({
    ownerId: ownerUser.id,
    identifier: String(formData.get('id') || ''),
    ...(fixedProjectId ? { projectId: fixedProjectId } : {}),
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? 'Failed to delete task.' };
  }

  await writeAuditLog({
    ownerId: ownerUser.id,
    action: 'task.deleted',
    targetType: 'task',
    targetId: result.data.taskKey,
    meta: { projectId: result.data.projectId },
  });

  redirect(boardHref);
}
