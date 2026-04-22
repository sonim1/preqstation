'use server';

import { revalidatePath } from 'next/cache';

import { createProject as runCreateProject } from '@/lib/actions/project-actions';
import { createTask as runCreateTask } from '@/lib/actions/task-actions';
import { writeAuditLog } from '@/lib/audit';
import { isNextRedirectError } from '@/lib/next-utils';
import { requireOwnerUser } from '@/lib/owner';

export type OnboardingProjectResult =
  | { ok: true; projectId: string; projectName: string }
  | { ok: false; message: string };

export type OnboardingTaskResult = { ok: true } | { ok: false; message: string };

export async function createOnboardingProject(
  _prevState: unknown,
  formData: FormData,
): Promise<OnboardingProjectResult> {
  const ownerUser = await requireOwnerUser();
  const result = await runCreateProject({
    ownerId: ownerUser.id,
    name: String(formData.get('name') || ''),
    projectKey: String(formData.get('projectKey') || ''),
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
  return { ok: true as const, projectId: result.data.id, projectName: result.data.projectKey };
}

export async function createOnboardingTask(
  _prevState: unknown,
  formData: FormData,
): Promise<OnboardingTaskResult> {
  try {
    const ownerUser = await requireOwnerUser();
    const result = await runCreateTask({
      ownerId: ownerUser.id,
      title: String(formData.get('title') || ''),
      projectId: String(formData.get('projectId') || ''),
    });

    if (!result.ok) {
      return { ok: false as const, message: result.message ?? 'Failed to create task.' };
    }

    await writeAuditLog({
      ownerId: ownerUser.id,
      action: 'task.created',
      targetType: 'task',
      targetId: result.data.taskKey,
      meta: { projectId: result.data.projectId },
    });

    revalidatePath('/');
    return { ok: true as const };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('[createOnboardingTask] failed:', error);
    return { ok: false as const, message: 'An error occurred while creating the task.' };
  }
}
