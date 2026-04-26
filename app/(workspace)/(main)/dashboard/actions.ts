'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createProject as runCreateProjectAction,
  createWorkLog as runCreateWorkLogAction,
  updateProject as runUpdateProjectAction,
} from '@/lib/actions/project-actions';
import {
  createTask as runCreateTodoAction,
  deleteTask as runDeleteTodoAction,
  updateTask as runUpdateTodoAction,
  updateTaskStatus as runUpdateTodoStatusAction,
} from '@/lib/actions/task-actions';
import { writeAuditLog } from '@/lib/audit';
import { getDayRangeForTimeZone } from '@/lib/date-time';
import { withOwnerDb } from '@/lib/db/rls';
import { tasks } from '@/lib/db/schema';
import { isNextRedirectError } from '@/lib/next-utils';
import { requireOwnerUser } from '@/lib/owner';
import { getTaskLabelIdsFromFormData } from '@/lib/task-labels';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

type ActionState = { ok: true } | { ok: false; message: string };

// ---------- Project actions (thin wrappers) ----------

export async function createProject(_prevState: unknown, formData: FormData): Promise<ActionState> {
  const ownerUser = await requireOwnerUser();
  const result = await runCreateProjectAction({
    ownerId: ownerUser.id,
    name: String(formData.get('name') || ''),
    projectKey: String(formData.get('projectKey') || ''),
    descriptionMd: String(formData.get('descriptionMd') || ''),
    bgImage: String(formData.get('bgImage') || ''),
    bgImageCredit: String(formData.get('bgImageCredit') || ''),
  });

  if (!result.ok) {
    return { ok: false as const, message: result.message ?? 'Failed to create project.' };
  }

  await writeAuditLog({
    ownerId: ownerUser.id,
    action: 'project.created',
    targetType: 'project',
    targetId: result.data.id,
    meta: { projectKey: result.data.projectKey },
  });

  revalidatePath('/');
  redirect('/dashboard');
}

export async function updateProject(_prevState: unknown, formData: FormData): Promise<ActionState> {
  const ownerUser = await requireOwnerUser();
  const priorityRaw = String(formData.get('priority') || '').trim();
  const result = await runUpdateProjectAction({
    ownerId: ownerUser.id,
    projectId: String(formData.get('projectId') || ''),
    name: String(formData.get('name') || ''),
    status: String(formData.get('status') || ''),
    priority: priorityRaw ? parseInt(priorityRaw, 10) : undefined,
    descriptionMd: String(formData.get('descriptionMd') || ''),
    bgImage: String(formData.get('bgImage') || ''),
    bgImageCredit: String(formData.get('bgImageCredit') || ''),
    repoUrl: String(formData.get('repoUrl') || ''),
    vercelUrl: String(formData.get('vercelUrl') || ''),
  });

  if (!result.ok) {
    return { ok: false as const, message: result.message ?? 'Failed to update project.' };
  }

  if (result.data.changed) {
    await writeAuditLog({
      ownerId: ownerUser.id,
      action: 'project.updated',
      targetType: 'project',
      targetId: result.data.id,
      meta: { projectKey: result.data.projectKey },
    });
  }

  revalidatePath('/projects');
  revalidatePath('/dashboard');
  revalidatePath(`/project/${result.data.projectKey}`);
  revalidatePath(`/board/${result.data.projectKey}`);
  return { ok: true as const };
}
export async function createWorkLog(_prevState: unknown, formData: FormData): Promise<ActionState> {
  try {
    const ownerUser = await requireOwnerUser();
    const result = await runCreateWorkLogAction({
      ownerId: ownerUser.id,
      title: String(formData.get('title') || ''),
      detailMd: String(formData.get('detailMd') || ''),
      projectId: String(formData.get('projectId') || ''),
    });

    if (!result.ok) {
      return { ok: false as const, message: result.message ?? 'Failed to create work log.' };
    }

    await writeAuditLog({
      ownerId: ownerUser.id,
      action: 'work_log.created',
      targetType: 'work_log',
      targetId: result.data.id,
      meta: { projectId: result.data.projectId },
    });

    revalidatePath('/');
    redirect('/dashboard');
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('[createWorkLog] failed:', error);
    return { ok: false as const, message: 'An error occurred while creating the work log.' };
  }
}

// ---------- Todo actions (thin wrappers) ----------

export async function createTodo(_prevState: unknown, formData: FormData): Promise<ActionState> {
  try {
    const ownerUser = await requireOwnerUser();
    const result = await runCreateTodoAction({
      ownerId: ownerUser.id,
      title: String(formData.get('title') || ''),
      contentMd: String(formData.get('contentMd') || ''),
      projectId: String(formData.get('projectId') || ''),
      labelIds: getTaskLabelIdsFromFormData(formData),
      taskPriority: String(formData.get('taskPriority') || ''),
    });
    if (!result.ok) {
      return { ok: false as const, message: result.message ?? 'Failed to create task.' };
    }

    await writeAuditLog({
      ownerId: ownerUser.id,
      action: 'task.created',
      targetType: 'task',
      targetId: result.data.taskKey,
      meta: {
        projectId: result.data.projectId,
        labelId: result.data.labelId,
        labelIds: result.data.labelIds,
        taskPriority: result.data.taskPriority,
      },
    });

    revalidatePath('/');
    redirect('/dashboard');
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('[createTodo] failed:', error);
    return { ok: false as const, message: 'An error occurred while creating the task.' };
  }
}

export async function updateTodoStatus(formData: FormData) {
  const ownerUser = await requireOwnerUser();

  const result = await runUpdateTodoStatusAction({
    ownerId: ownerUser.id,
    identifier: String(formData.get('id') || ''),
    status: String(formData.get('status') || ''),
  });
  if (!result.ok || !result.data.changed) return;

  await writeAuditLog({
    ownerId: ownerUser.id,
    action: 'task.status.updated',
    targetType: 'task',
    targetId: result.data.taskKey,
    meta: { fromStatus: result.data.fromStatus, status: result.data.status },
  });

  revalidatePath('/');
}

export async function updateTodo(_prevState: unknown, formData: FormData): Promise<ActionState> {
  try {
    const ownerUser = await requireOwnerUser();
    const result = await runUpdateTodoAction({
      ownerId: ownerUser.id,
      identifier: String(formData.get('id') || ''),
      baseNoteFingerprint: String(formData.get('baseNoteFingerprint') || ''),
      title: String(formData.get('title') || ''),
      noteMd: String(formData.get('noteMd') || ''),
      labelIds: getTaskLabelIdsFromFormData(formData),
      taskPriority: String(formData.get('taskPriority') || ''),
      runState: String(formData.get('runState') || ''),
      projectId: String(formData.get('projectId') || ''),
    });
    if (!result.ok) {
      return { ok: false as const, message: result.message ?? 'Failed to update task.' };
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

    revalidatePath('/');
    return { ok: true as const };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('[updateTodo] failed:', error);
    return { ok: false as const, message: 'An error occurred while updating the task.' };
  }
}

export async function toggleTodayFocus(formData: FormData) {
  const ownerUser = await requireOwnerUser();
  const taskId = String(formData.get('taskId') || '');
  if (!taskId) return;

  await withOwnerDb(ownerUser.id, async (client) => {
    const timeZone = await getUserSetting(ownerUser.id, SETTING_KEYS.TIMEZONE, client);
    const dayRange = getDayRangeForTimeZone(timeZone);
    const existing = await client.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.ownerId, ownerUser.id)),
      columns: { id: true, focusedAt: true },
    });
    if (!existing) return;

    const isFocused =
      !!existing.focusedAt &&
      existing.focusedAt >= dayRange.start &&
      existing.focusedAt < dayRange.end;
    await client
      .update(tasks)
      .set({ focusedAt: isFocused ? null : new Date() })
      .where(eq(tasks.id, existing.id));
  });

  revalidatePath('/');
}

export async function deleteTodo(_prevState: unknown, formData: FormData): Promise<ActionState> {
  const ownerUser = await requireOwnerUser();

  const result = await runDeleteTodoAction({
    ownerId: ownerUser.id,
    identifier: String(formData.get('id') || ''),
  });
  if (!result.ok) {
    return { ok: false as const, message: result.message ?? 'Failed to delete task.' };
  }

  await writeAuditLog({
    ownerId: ownerUser.id,
    action: 'task.deleted',
    targetType: 'task',
    targetId: result.data.taskKey,
    meta: { projectId: result.data.projectId },
  });

  revalidatePath('/');
  redirect('/dashboard');
}
