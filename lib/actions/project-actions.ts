'use server';

import { and, eq, isNull } from 'drizzle-orm';

import { withOwnerDb } from '@/lib/db/rls';
import { projects, workLogs } from '@/lib/db/schema';
import { stripPreqChoiceBlocks } from '@/lib/markdown';
import { ENTITY_PROJECT, PROJECT_CREATED, PROJECT_UPDATED, writeOutboxEvent } from '@/lib/outbox';
import {
  getProjectBackgroundCredit,
  isValidBgValue,
  parseProjectBackgroundCredit,
} from '@/lib/project-backgrounds';
import {
  assertValidProjectKeyInput,
  inferDefaultProjectKeyFromName,
  isProjectKeyTaken,
  isProjectKeyUniqueConstraintError,
  ProjectKeyConflictError,
  ProjectKeyValidationError,
  resolveUniqueProjectKey,
} from '@/lib/project-key';
import { DEFAULT_PROJECT_STATUS, isProjectStatus } from '@/lib/project-meta';
import {
  PROJECT_SETTING_KEYS,
  resolveDeployStrategyConfig,
  setProjectSetting,
} from '@/lib/project-settings';
import { isUuidIdentifier } from '@/lib/task-keys';

type ProjectActionErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'UNEXPECTED';

type ProjectActionSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectActionFailure = {
  ok: false;
  code: ProjectActionErrorCode;
  message: string;
};

export type ProjectActionResult<T> = ProjectActionSuccess<T> | ProjectActionFailure;

function ok<T>(data: T): ProjectActionResult<T> {
  return { ok: true, data };
}

function fail<T>(code: ProjectActionErrorCode, message: string): ProjectActionResult<T> {
  return { ok: false, code, message };
}

function normalizeOptionalUrl(value: string) {
  const input = value.trim();
  if (!input) return null;
  try {
    return new URL(input).toString();
  } catch {
    return null;
  }
}

// ---------- createProject ----------

export type CreateProjectParams = {
  ownerId: string;
  name: string;
  projectKey?: string | null;
  descriptionMd?: string | null;
  bgImage?: string | null;
  bgImageCredit?: unknown;
};

export type CreateProjectData = {
  id: string;
  projectKey: string;
};

export async function createProject(
  params: CreateProjectParams,
): Promise<ProjectActionResult<CreateProjectData>> {
  const name = (params.name || '').trim();
  if (!name) {
    return fail('INVALID_INPUT', 'Project name is required.');
  }

  const projectKeyRaw = (params.projectKey || '').trim();
  const bgImage = params.bgImage?.trim() || null;
  const bgImageCredit = parseProjectBackgroundCredit(params.bgImageCredit);
  const descriptionMd = stripPreqChoiceBlocks(params.descriptionMd).trim();

  if (!isValidBgValue(bgImage)) {
    return fail('INVALID_INPUT', 'Invalid background image.');
  }
  if (!bgImageCredit.ok) {
    return fail('INVALID_INPUT', 'Invalid background image credit.');
  }

  const nextBgImageCredit =
    bgImage && !getProjectBackgroundCredit(bgImage, null) ? bgImageCredit.value : null;

  let projectKey = '';
  try {
    const project = await withOwnerDb(params.ownerId, async (client) => {
      if (projectKeyRaw) {
        projectKey = assertValidProjectKeyInput(projectKeyRaw);
        if (await isProjectKeyTaken(params.ownerId, projectKey, client)) {
          return fail<CreateProjectData>('CONFLICT', 'Project key already taken.');
        }
      } else {
        projectKey = await resolveUniqueProjectKey(
          params.ownerId,
          inferDefaultProjectKeyFromName(name),
          client,
        );
      }

      const [created] = await client
        .insert(projects)
        .values({
          ownerId: params.ownerId,
          projectKey,
          name,
          description: descriptionMd || null,
          bgImage,
          bgImageCredit: nextBgImageCredit,
          priority: 2,
          status: DEFAULT_PROJECT_STATUS,
        })
        .returning();

      await writeOutboxEvent({
        tx: client,
        ownerId: params.ownerId,
        eventType: PROJECT_CREATED,
        entityType: ENTITY_PROJECT,
        entityId: created.id,
        payload: { name, projectKey },
      });

      return ok({ id: created.id, projectKey: created.projectKey });
    });

    return project;
  } catch (error) {
    if (
      error instanceof ProjectKeyValidationError ||
      error instanceof ProjectKeyConflictError ||
      isProjectKeyUniqueConstraintError(error)
    ) {
      return fail('CONFLICT', 'Invalid or duplicate project key.');
    }
    console.error('[createProject] failed:', error);
    return fail('UNEXPECTED', 'Failed to create project.');
  }
}

// ---------- updateProject ----------

export type UpdateProjectParams = {
  ownerId: string;
  projectId: string;
  name?: string | null;
  status?: string | null;
  priority?: number;
  descriptionMd?: string | null;
  bgImage?: string | null;
  bgImageCredit?: unknown;
  repoUrl?: string | null;
  vercelUrl?: string | null;
};

export type UpdateProjectData = {
  id: string;
  projectKey: string;
  changed: boolean;
};

export async function updateProject(
  params: UpdateProjectParams,
): Promise<ProjectActionResult<UpdateProjectData>> {
  const projectId = (params.projectId || '').trim();
  if (!projectId) {
    return fail('INVALID_INPUT', 'Project ID is required.');
  }

  const name = (params.name || '').trim();
  const status = (params.status || '').trim();
  const priority = params.priority;

  return withOwnerDb(params.ownerId, async (client) => {
    const existing = await client.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.ownerId, params.ownerId),
        isNull(projects.deletedAt),
      ),
      columns: {
        id: true,
        projectKey: true,
        name: true,
        status: true,
        priority: true,
        description: true,
        bgImage: true,
        bgImageCredit: true,
        repoUrl: true,
        vercelUrl: true,
      },
    });
    if (!existing) {
      return fail('NOT_FOUND', 'Project not found.');
    }

    const nextName = name || existing.name;
    const nextStatus = isProjectStatus(status) ? status : existing.status;
    const nextPriority = priority && priority >= 1 && priority <= 5 ? priority : existing.priority;
    const nextDescription = stripPreqChoiceBlocks(params.descriptionMd).trim() || null;
    const nextBgImage = params.bgImage?.trim() ?? null;
    const parsedBgImageCredit = parseProjectBackgroundCredit(params.bgImageCredit);

    if (!isValidBgValue(nextBgImage)) {
      return fail('INVALID_INPUT', 'Invalid background image.');
    }
    if (!parsedBgImageCredit.ok) {
      return fail('INVALID_INPUT', 'Invalid background image credit.');
    }

    const nextBgImageCredit =
      nextBgImage && !getProjectBackgroundCredit(nextBgImage, null)
        ? parsedBgImageCredit.value
        : null;
    const existingBgImageCredit = parseProjectBackgroundCredit(existing.bgImageCredit);
    const nextRepoUrl =
      params.repoUrl === undefined
        ? (existing.repoUrl ?? null)
        : normalizeOptionalUrl(params.repoUrl || '');
    const nextVercelUrl =
      params.vercelUrl === undefined
        ? (existing.vercelUrl ?? null)
        : normalizeOptionalUrl(params.vercelUrl || '');

    const changed =
      existing.name !== nextName ||
      existing.status !== nextStatus ||
      existing.priority !== nextPriority ||
      (existing.description ?? null) !== nextDescription ||
      (existing.bgImage ?? null) !== nextBgImage ||
      (existing.repoUrl ?? null) !== nextRepoUrl ||
      (existing.vercelUrl ?? null) !== nextVercelUrl ||
      JSON.stringify(existingBgImageCredit.ok ? existingBgImageCredit.value : null) !==
        JSON.stringify(nextBgImageCredit);
    const changedFields = [
      existing.name !== nextName ? 'name' : null,
      existing.status !== nextStatus ? 'status' : null,
      existing.priority !== nextPriority ? 'priority' : null,
      (existing.description ?? null) !== nextDescription ? 'description' : null,
      (existing.bgImage ?? null) !== nextBgImage ? 'bgImage' : null,
      JSON.stringify(existingBgImageCredit.ok ? existingBgImageCredit.value : null) !==
      JSON.stringify(nextBgImageCredit)
        ? 'bgImageCredit'
        : null,
    ].filter((field): field is string => field !== null);

    if (!changed) {
      return ok({ id: existing.id, projectKey: existing.projectKey, changed: false });
    }

    await client
      .update(projects)
      .set({
        name: nextName,
        status: nextStatus,
        priority: nextPriority,
        description: nextDescription,
        bgImage: nextBgImage,
        bgImageCredit: nextBgImageCredit,
        repoUrl: nextRepoUrl,
        vercelUrl: nextVercelUrl,
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.ownerId, params.ownerId),
          isNull(projects.deletedAt),
        ),
      );

    await writeOutboxEvent({
      tx: client,
      ownerId: params.ownerId,
      projectId: existing.id,
      eventType: PROJECT_UPDATED,
      entityType: ENTITY_PROJECT,
      entityId: existing.projectKey,
      payload: { fields: changedFields },
    });

    return ok({ id: existing.id, projectKey: existing.projectKey, changed: true });
  });
}
// ---------- updateProjectDeploySettings ----------

export type UpdateProjectDeploySettingsParams = {
  ownerId: string;
  projectId: string;
  strategy?: string | null;
  defaultBranch?: string | null;
  autoPr?: string | null;
  commitOnReview?: string | null;
  squashMerge?: string | null;
};

export type UpdateProjectDeploySettingsData = {
  id: string;
  settings: {
    strategy: string;
    default_branch: string;
    auto_pr: boolean;
    commit_on_review: boolean;
    squash_merge: boolean;
  };
};

export async function updateProjectDeploySettings(
  params: UpdateProjectDeploySettingsParams,
): Promise<ProjectActionResult<UpdateProjectDeploySettingsData>> {
  const id = (params.projectId || '').trim();
  if (!id) {
    return fail('INVALID_INPUT', 'Project ID is required.');
  }

  return withOwnerDb(params.ownerId, async (client) => {
    const existing = await client.query.projects.findFirst({
      where: and(
        eq(projects.id, id),
        eq(projects.ownerId, params.ownerId),
        isNull(projects.deletedAt),
      ),
      columns: { id: true, projectKey: true },
    });
    if (!existing) {
      return fail('NOT_FOUND', 'Project not found.');
    }

    const incoming = {
      [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: (params.strategy || '').trim(),
      [PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH]: (params.defaultBranch || '').trim(),
      [PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR]: (params.autoPr || '').trim(),
      [PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW]: (params.commitOnReview || '').trim(),
      [PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE]: (params.squashMerge || '').trim(),
    };

    const next = resolveDeployStrategyConfig(incoming);

    await Promise.all([
      setProjectSetting(id, PROJECT_SETTING_KEYS.DEPLOY_STRATEGY, next.strategy, client),
      setProjectSetting(
        id,
        PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH,
        next.default_branch,
        client,
      ),
      setProjectSetting(id, PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR, String(next.auto_pr), client),
      setProjectSetting(
        id,
        PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW,
        String(next.commit_on_review),
        client,
      ),
      setProjectSetting(
        id,
        PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE,
        String(next.squash_merge),
        client,
      ),
    ]);

    await writeOutboxEvent({
      tx: client,
      ownerId: params.ownerId,
      projectId: existing.id,
      eventType: PROJECT_UPDATED,
      entityType: ENTITY_PROJECT,
      entityId: existing.projectKey,
      payload: {
        fields: [
          PROJECT_SETTING_KEYS.DEPLOY_STRATEGY,
          PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH,
          PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR,
          PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW,
          PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE,
        ],
      },
    });

    return ok({
      id,
      settings: next,
    });
  });
}

// ---------- updateProjectAgentInstructions ----------

export type UpdateProjectAgentInstructionsParams = {
  ownerId: string;
  projectId: string;
  instructions?: string | null;
};

export type UpdateProjectAgentInstructionsData = {
  id: string;
  instructions: string;
};

export async function updateProjectAgentInstructions(
  params: UpdateProjectAgentInstructionsParams,
): Promise<ProjectActionResult<UpdateProjectAgentInstructionsData>> {
  const id = (params.projectId || '').trim();
  if (!id) {
    return fail('INVALID_INPUT', 'Project ID is required.');
  }

  return withOwnerDb(params.ownerId, async (client) => {
    const existing = await client.query.projects.findFirst({
      where: and(
        eq(projects.id, id),
        eq(projects.ownerId, params.ownerId),
        isNull(projects.deletedAt),
      ),
      columns: { id: true, projectKey: true },
    });
    if (!existing) {
      return fail('NOT_FOUND', 'Project not found.');
    }

    const instructions = (params.instructions || '').trim();
    await setProjectSetting(id, PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS, instructions, client);

    await writeOutboxEvent({
      tx: client,
      ownerId: params.ownerId,
      projectId: existing.id,
      eventType: PROJECT_UPDATED,
      entityType: ENTITY_PROJECT,
      entityId: existing.projectKey,
      payload: { fields: [PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS] },
    });

    return ok({
      id,
      instructions,
    });
  });
}

// ---------- createWorkLog ----------

export type CreateWorkLogParams = {
  ownerId: string;
  title: string;
  detailMd?: string | null;
  projectId?: string | null;
};

export type CreateWorkLogData = {
  id: string;
  projectId: string | null;
};

export async function createWorkLog(
  params: CreateWorkLogParams,
): Promise<ProjectActionResult<CreateWorkLogData>> {
  const title = (params.title || '').trim();
  if (!title) {
    return fail('INVALID_INPUT', 'Title is required.');
  }
  const detailMd = stripPreqChoiceBlocks(params.detailMd).trim();

  const projectIdRaw = (params.projectId || '').trim();
  let projectId: string | null = null;

  return withOwnerDb(params.ownerId, async (client) => {
    if (projectIdRaw) {
      if (!isUuidIdentifier(projectIdRaw)) {
        return fail('INVALID_INPUT', 'Invalid project ID.');
      }

      const project = await client.query.projects.findFirst({
        where: and(
          eq(projects.id, projectIdRaw),
          eq(projects.ownerId, params.ownerId),
          isNull(projects.deletedAt),
        ),
        columns: { id: true },
      });
      if (!project) {
        return fail('NOT_FOUND', 'Project not found.');
      }

      projectId = project.id;
    }

    const [workLog] = await client
      .insert(workLogs)
      .values({
        ownerId: params.ownerId,
        title,
        detail: detailMd || null,
        projectId,
        workedAt: new Date(),
      })
      .returning();

    return ok({ id: workLog.id, projectId: workLog.projectId });
  });
}
