import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { TODO_NOTE_MAX_LENGTH, TODO_TITLE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, tasks, workLogs } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import {
  ENTITY_TASK,
  ENTITY_WORKLOG,
  TASK_DELETED,
  TASK_STATUS_CHANGED,
  TASK_UPDATED,
  WORKLOG_CREATED,
  writeOutboxEvent,
  writeOutboxEventStandalone,
} from '@/lib/outbox';
import {
  buildTaskNote,
  extractLatestPreqResultMeta,
  fetchAvailableLabels,
  normalizePreqTaskLabelNames,
  normalizeTaskPriority,
  parseAcceptanceCriteria,
  PREQ_TASK_STATUSES,
  renderResultWorkLogDetail,
  resolveOrCreateLabelId,
  resolveProjectByRepo,
  serializePreqTask,
  toInternalTaskStatus,
  toPreqTaskStatus,
} from '@/lib/preq-task';
import { resolveDeployStrategyConfig } from '@/lib/project-settings';
import {
  isTaskKeyUniqueConstraintError,
  normalizeTaskIdentifier,
  taskWhereByIdentifier,
} from '@/lib/task-keys';
import {
  extractTaskLabels,
  summarizeTaskLabelNames,
  syncTaskLabelAssignments,
} from '@/lib/task-labels';
import { coerceTaskRunState, type TaskStatus } from '@/lib/task-meta';
import { safeCreateTaskCompletionNotification } from '@/lib/task-notifications';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import {
  addTaskFieldChange,
  buildTaskFieldChangeWorkLog,
  buildTaskNoteChangeDetail,
  buildTaskStatusChangeWorkLog,
  summarizeAcceptanceCriteria,
  summarizeContent,
  type TaskFieldChange,
  taskPriorityLabel,
} from '@/lib/task-worklog';

const PREQ_LIFECYCLE_ACTIONS = ['plan', 'start', 'complete', 'review', 'block'] as const;
type PreqLifecycleAction = (typeof PREQ_LIFECYCLE_ACTIONS)[number];

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH).optional(),
  description: z.string().trim().max(TODO_NOTE_MAX_LENGTH).optional().or(z.literal('')),
  planMarkdown: z.string().trim().max(TODO_NOTE_MAX_LENGTH).optional().or(z.literal('')),
  noteMarkdown: z.string().max(TODO_NOTE_MAX_LENGTH).optional(),
  status: z.enum(PREQ_TASK_STATUSES).optional(),
  lifecycle_action: z.enum(PREQ_LIFECYCLE_ACTIONS).optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  repo: z.string().trim().optional().or(z.literal('')),
  branch: z.string().trim().optional().or(z.literal('')),
  labels: z.array(z.string().trim().min(1).max(40)).optional(),
  acceptance_criteria: z.array(z.string().trim().min(1).max(200)).optional(),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  result: z.record(z.string(), z.unknown()).optional(),
});

function readRequestedPrUrl(result: Record<string, unknown> | undefined) {
  if (!result || typeof result !== 'object') return '';
  const snakeCase = typeof result.pr_url === 'string' ? result.pr_url : '';
  const camelCase = typeof result.prUrl === 'string' ? result.prUrl : '';
  return (snakeCase || camelCase).trim();
}

function buildAutoPrCompletionError(params: {
  defaultBranch: string;
  missingBranch: boolean;
  missingPrUrl: boolean;
}) {
  const missing: string[] = [];
  if (params.missingBranch) missing.push('feature branch name');
  if (params.missingPrUrl) missing.push('pull request URL');

  return [
    'This project cannot move to ready yet.',
    'Deployment strategy requires a pushed feature branch and PR before review (feature_branch + auto_pr + commit_on_review).',
    `Missing: ${missing.join(' and ')}.`,
    `Push the branch, create a PR targeting ${params.defaultBranch} via GitHub MCP or \`gh pr create\`, then retry \`preq_complete_task\` with both \`branchName\` and \`prUrl\`.`,
  ].join(' ');
}

function resolveLifecycleTransition(
  action: PreqLifecycleAction | undefined,
  currentStatus: string,
): {
  nextStatus: TaskStatus | undefined;
  nextRunState: 'running' | null | undefined;
  error?: string;
} {
  if (!action) {
    return { nextStatus: undefined, nextRunState: undefined };
  }

  switch (action) {
    case 'start':
      if (!['inbox', 'todo', 'hold', 'ready'].includes(currentStatus)) {
        return {
          nextStatus: undefined,
          nextRunState: undefined,
          error: `PREQ lifecycle action "start" requires inbox, todo, hold, or ready. Current status: ${currentStatus || 'unknown'}.`,
        };
      }
      return { nextStatus: undefined, nextRunState: 'running' };
    case 'plan':
      return {
        nextStatus: currentStatus === 'inbox' ? 'todo' : undefined,
        nextRunState: null,
      };
    case 'complete':
      if (currentStatus !== 'todo' && currentStatus !== 'hold') {
        return {
          nextStatus: undefined,
          nextRunState: undefined,
          error: `PREQ lifecycle action "complete" requires todo or hold. Current status: ${currentStatus || 'unknown'}.`,
        };
      }
      return { nextStatus: 'ready', nextRunState: null };
    case 'review':
      if (currentStatus !== 'ready') {
        return {
          nextStatus: undefined,
          nextRunState: undefined,
          error: `PREQ lifecycle action "review" requires ready. Current status: ${currentStatus || 'unknown'}.`,
        };
      }
      return { nextStatus: 'done', nextRunState: null };
    case 'block':
      if (!['inbox', 'todo', 'hold', 'ready'].includes(currentStatus)) {
        return {
          nextStatus: undefined,
          nextRunState: undefined,
          error: `PREQ lifecycle action "block" requires an active task. Current status: ${currentStatus || 'unknown'}.`,
        };
      }
      return { nextStatus: 'hold', nextRunState: null };
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    return await withOwnerDb(auth.ownerId, async (client) => {
      const todo = await client.query.tasks.findFirst({
        where: and(
          taskWhereByIdentifier(auth.ownerId, id),
          or(
            isNull(tasks.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
        with: {
          project: {
            columns: { repoUrl: true },
            with: {
              projectSettings: {
                columns: { key: true, value: true },
              },
            },
          },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: {
                columns: { id: true, name: true, color: true },
              },
            },
          },
        },
      });

      if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const available_labels = await fetchAvailableLabels(auth.ownerId, todo.projectId, client);
      const latestPreqResultLog = await client.query.workLogs.findFirst({
        where: and(
          eq(workLogs.ownerId, auth.ownerId),
          eq(workLogs.taskId, todo.id),
          like(workLogs.title, 'PREQSTATION Result%'),
        ),
        orderBy: [desc(workLogs.workedAt), desc(workLogs.createdAt)],
        columns: { title: true, detail: true, workedAt: true },
      });

      return NextResponse.json({
        task: serializePreqTask(
          {
            id: todo.id,
            taskKey: todo.taskKey,
            taskPrefix: todo.taskPrefix,
            taskNumber: todo.taskNumber,
            title: todo.title,
            note: todo.note,
            status: todo.status,
            taskPriority: todo.taskPriority,
            branch: todo.branch ?? null,
            engine: todo.engine ?? null,
            dispatchTarget: todo.dispatchTarget ?? null,
            runState: coerceTaskRunState(todo.runState),
            runStateUpdatedAt: todo.runStateUpdatedAt ?? null,
            latestPreqResult: latestPreqResultLog
              ? extractLatestPreqResultMeta(latestPreqResultLog)
              : null,
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
            project: todo.project
              ? {
                  repoUrl: todo.project.repoUrl,
                  settings: todo.project.projectSettings,
                }
              : null,
            labels: extractTaskLabels(todo).map((label) => ({ name: label.name })),
          },
          auth.ownerEmail,
        ),
        available_labels,
      });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load task' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let taskId: string | null = null;
  let lifecycleAction: PreqLifecycleAction | undefined;
  let requestedStatus: string | null = null;
  let existingStatus: string | null = null;
  let hasResult = false;
  let hasBranch = false;

  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    taskId = id;
    const body = (await req.json()) as Record<string, unknown>;
    if ('id' in body || 'taskKey' in body || 'taskPrefix' in body || 'taskNumber' in body) {
      return NextResponse.json(
        { error: 'Task ID is auto-generated and cannot be edited.' },
        { status: 400 },
      );
    }
    const payload = updateTaskSchema.parse(body);
    lifecycleAction = payload.lifecycle_action;
    requestedStatus = payload.status ?? null;
    hasResult = payload.result !== undefined;
    hasBranch = payload.branch !== undefined;
    const resultEngine =
      payload.result && typeof payload.result.engine === 'string'
        ? (normalizeEngineKey(payload.result.engine) ?? '')
        : '';
    let nextEngine: string | null | undefined =
      payload.engine !== undefined
        ? payload.engine || null
        : resultEngine
          ? resultEngine
          : undefined;

    return await withOwnerDb(auth.ownerId, async (client) => {
      const existing = await client.query.tasks.findFirst({
        where: and(
          taskWhereByIdentifier(auth.ownerId, id),
          or(
            isNull(tasks.projectId),
            sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
          ),
        ),
        with: {
          project: {
            columns: { repoUrl: true },
            with: {
              projectSettings: {
                columns: { key: true, value: true },
              },
            },
          },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: {
                columns: { id: true, name: true, color: true },
              },
            },
          },
        },
      });

      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      existingStatus = existing.status;

      const nextDescription =
        payload.description !== undefined
          ? payload.description
          : payload.planMarkdown !== undefined
            ? payload.planMarkdown
            : existing.note || '';
      const planMarkdown =
        payload.planMarkdown !== undefined
          ? payload.planMarkdown.trim()
          : (payload.description?.trim() ?? '');
      const nextAcceptanceCriteria =
        payload.acceptance_criteria !== undefined
          ? payload.acceptance_criteria
          : parseAcceptanceCriteria(existing.note);

      if (payload.repo !== undefined) {
        const nextProject = payload.repo
          ? await resolveProjectByRepo(auth.ownerId, payload.repo, client)
          : null;
        if (!nextProject || nextProject.id !== existing.projectId) {
          return NextResponse.json(
            { error: 'Project changes are not supported.' },
            { status: 400 },
          );
        }
      }

      const nextLabelNames =
        payload.labels !== undefined ? normalizePreqTaskLabelNames(payload.labels) : undefined;
      const nextLabelIds =
        nextLabelNames === undefined
          ? undefined
          : (
              await Promise.all(
                nextLabelNames.map((labelName) =>
                  resolveOrCreateLabelId(auth.ownerId, existing.projectId, labelName, client),
                ),
              )
            ).filter((labelId): labelId is string => Boolean(labelId));
      let nextStatus =
        payload.status === undefined ? undefined : toInternalTaskStatus(payload.status);
      const lifecycleAction = payload.lifecycle_action;
      const lifecycleTransition = resolveLifecycleTransition(lifecycleAction, existing.status);
      if (lifecycleTransition.error) {
        return NextResponse.json({ error: lifecycleTransition.error }, { status: 409 });
      }
      const deployStrategy = resolveDeployStrategyConfig(existing.project?.projectSettings);
      const resolvedBranchName = (payload.branch ?? existing.branch ?? '').trim();
      const requestedPrUrl = readRequestedPrUrl(payload.result);
      const requiresPullRequestBeforeReady =
        lifecycleAction === 'complete' &&
        deployStrategy.strategy === 'feature_branch' &&
        deployStrategy.auto_pr &&
        deployStrategy.commit_on_review;
      if (requiresPullRequestBeforeReady && (!resolvedBranchName || !requestedPrUrl)) {
        return NextResponse.json(
          {
            error: buildAutoPrCompletionError({
              defaultBranch: deployStrategy.default_branch || 'main',
              missingBranch: !resolvedBranchName,
              missingPrUrl: !requestedPrUrl,
            }),
          },
          { status: 409 },
        );
      }
      if (lifecycleAction === 'plan' && planMarkdown.length === 0) {
        return NextResponse.json(
          { error: 'PREQ lifecycle action "plan" requires non-empty plan content.' },
          { status: 400 },
        );
      }
      if (lifecycleAction) {
        nextStatus = lifecycleTransition.nextStatus ?? nextStatus;
      }

      if (payload.planMarkdown && existing.status === 'inbox' && nextStatus === undefined) {
        nextStatus = 'todo';
      }

      const nextRunState = lifecycleAction
        ? lifecycleTransition.nextRunState
        : payload.status === undefined
          ? undefined
          : null;

      const updateData: Record<string, unknown> = {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.noteMarkdown !== undefined
          ? { note: payload.noteMarkdown }
          : payload.description !== undefined ||
              payload.planMarkdown !== undefined ||
              payload.acceptance_criteria !== undefined
            ? { note: buildTaskNote(nextDescription, nextAcceptanceCriteria) }
            : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(nextRunState !== undefined ? buildTaskRunStateUpdate(nextRunState) : {}),
        ...(payload.priority !== undefined
          ? { taskPriority: normalizeTaskPriority(payload.priority) }
          : {}),
        ...(payload.branch !== undefined ? { branch: payload.branch || null } : {}),
        ...(nextLabelIds !== undefined ? { labelId: nextLabelIds[0] ?? null } : {}),
        ...(nextEngine !== undefined ? { engine: nextEngine } : {}),
        ...(nextStatus === 'archived'
          ? { archivedAt: new Date() }
          : existing.status === 'archived' && nextStatus !== undefined
            ? { archivedAt: null }
            : {}),
      };

      if (nextLabelIds !== undefined) {
        await client.update(tasks).set(updateData).where(eq(tasks.id, existing.id));
        await syncTaskLabelAssignments(client, existing.id, nextLabelIds);
      } else {
        await client.update(tasks).set(updateData).where(eq(tasks.id, existing.id));
      }

      const updated = await client.query.tasks.findFirst({
        where: eq(tasks.id, existing.id),
        with: {
          project: {
            columns: { repoUrl: true },
            with: {
              projectSettings: {
                columns: { key: true, value: true },
              },
            },
          },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: {
                columns: { id: true, name: true, color: true },
              },
            },
          },
        },
      });

      if (!updated) return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });

      const descriptionChanged = (existing.note || '') !== (updated.note || '');
      const noteHistoryDetail = descriptionChanged
        ? buildTaskNoteChangeDetail({
            taskKey: updated.taskKey,
            taskTitle: updated.title,
            previousNote: existing.note,
            updatedNote: updated.note,
          })
        : null;
      const fieldChanges: TaskFieldChange[] = [];
      addTaskFieldChange(fieldChanges, 'Title', existing.title, updated.title);
      addTaskFieldChange(
        fieldChanges,
        'Priority',
        taskPriorityLabel(existing.taskPriority),
        taskPriorityLabel(updated.taskPriority),
      );
      addTaskFieldChange(
        fieldChanges,
        'Repo',
        existing.project?.repoUrl || 'No repo',
        updated.project?.repoUrl || 'No repo',
      );
      addTaskFieldChange(
        fieldChanges,
        'Labels',
        summarizeTaskLabelNames(extractTaskLabels(existing)),
        summarizeTaskLabelNames(extractTaskLabels(updated)),
      );
      addTaskFieldChange(
        fieldChanges,
        'Description',
        summarizeContent(existing.note),
        summarizeContent(updated.note),
      );
      addTaskFieldChange(
        fieldChanges,
        'Acceptance Criteria',
        summarizeAcceptanceCriteria(parseAcceptanceCriteria(existing.note)),
        summarizeAcceptanceCriteria(parseAcceptanceCriteria(updated.note)),
      );
      const changedFields = fieldChanges.map((change) => change.field);
      if (
        descriptionChanged &&
        !changedFields.includes('Description') &&
        !changedFields.includes('Acceptance Criteria')
      ) {
        changedFields.push('Description');
      }

      const fromStatus = toPreqTaskStatus(existing.status);
      const toStatus =
        payload.status !== undefined
          ? nextStatus
            ? toPreqTaskStatus(nextStatus)
            : toPreqTaskStatus(updated.status)
          : toPreqTaskStatus(updated.status);
      const statusChanged = fromStatus !== toStatus;
      if (statusChanged) {
        const statusLog = buildTaskStatusChangeWorkLog({
          taskKey: updated.taskKey,
          taskTitle: updated.title,
          fromStatus,
          toStatus,
          extraChanges: fieldChanges,
        });
        const [createdLog] = await client
          .insert(workLogs)
          .values({
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            taskId: updated.id,
            title: statusLog.title,
            detail: statusLog.detail,
            engine: updated.engine ?? null,
            workedAt: new Date(),
          })
          .returning();
        await writeOutboxEventStandalone(
          {
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            eventType: WORKLOG_CREATED,
            entityType: ENTITY_WORKLOG,
            entityId: createdLog.id,
          },
          client,
        );
      } else {
        const fieldLog = buildTaskFieldChangeWorkLog({
          taskKey: updated.taskKey,
          taskTitle: updated.title,
          changes: fieldChanges,
        });
        if (fieldLog) {
          const [createdLog] = await client
            .insert(workLogs)
            .values({
              ownerId: auth.ownerId,
              projectId: updated.projectId,
              taskId: updated.id,
              title: fieldLog.title,
              detail: fieldLog.detail,
              engine: updated.engine ?? null,
              workedAt: new Date(),
            })
            .returning();
          await writeOutboxEventStandalone(
            {
              ownerId: auth.ownerId,
              projectId: updated.projectId,
              eventType: WORKLOG_CREATED,
              entityType: ENTITY_WORKLOG,
              entityId: createdLog.id,
            },
            client,
          );
        }
      }

      if (noteHistoryDetail) {
        const [noteHistoryLog] = await client
          .insert(workLogs)
          .values({
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            taskId: updated.id,
            title: `${updated.taskKey} · Note Updated`,
            detail: noteHistoryDetail,
            engine: updated.engine ?? null,
            workedAt: new Date(),
          })
          .returning();
        await writeOutboxEventStandalone(
          {
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            eventType: WORKLOG_CREATED,
            entityType: ENTITY_WORKLOG,
            entityId: noteHistoryLog.id,
          },
          client,
        );
      }

      const isPlanUpdate =
        payload.result === undefined &&
        updated.status === 'todo' &&
        planMarkdown.length > 0 &&
        (lifecycleAction === 'plan' ||
          payload.status === 'todo' ||
          payload.planMarkdown !== undefined);
      if (isPlanUpdate) {
        const planLogEngine = updated.engine ?? resultEngine;
        const [planLog] = await client
          .insert(workLogs)
          .values({
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            taskId: updated.id,
            title: `PREQSTATION Plan · ${updated.title}`,
            detail: renderResultWorkLogDetail({
              taskId: updated.taskKey,
              title: updated.title,
              result: {
                summary: planMarkdown,
                planned_at: new Date().toISOString(),
              },
              tokenName: auth.tokenName,
              engine: planLogEngine,
            }),
            engine: planLogEngine,
            workedAt: new Date(),
          })
          .returning();
        await writeOutboxEventStandalone(
          {
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            eventType: WORKLOG_CREATED,
            entityType: ENTITY_WORKLOG,
            entityId: planLog.id,
          },
          client,
        );
      }

      if (payload.result) {
        const isPlanResult =
          typeof payload.result === 'object' &&
          payload.result !== null &&
          'planned_at' in payload.result;
        const resultLogEngine = updated.engine ?? (resultEngine || null);
        const resultLogTitle = isPlanResult
          ? `PREQSTATION Plan · ${updated.title}`
          : `PREQSTATION Result · ${updated.title}`;
        const [resultLog] = await client
          .insert(workLogs)
          .values({
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            taskId: updated.id,
            title: resultLogTitle,
            detail: renderResultWorkLogDetail({
              taskId: updated.taskKey,
              title: updated.title,
              result: payload.result,
              tokenName: auth.tokenName,
              engine: resultLogEngine,
            }),
            engine: resultLogEngine,
            workedAt: new Date(),
          })
          .returning();
        await writeOutboxEventStandalone(
          {
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            eventType: WORKLOG_CREATED,
            entityType: ENTITY_WORKLOG,
            entityId: resultLog.id,
          },
          client,
        );
      }

      await safeCreateTaskCompletionNotification({
        tx: client,
        ownerId: auth.ownerId,
        projectId: updated.projectId,
        taskId: updated.id,
        taskKey: updated.taskKey,
        taskTitle: updated.title,
        fromStatus: existing.status,
        toStatus: updated.status,
        previousRunState: existing.runState,
        nextRunState: updated.runState,
        lifecycleAction: lifecycleAction ?? null,
      });

      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: 'task.updated.via_api_token',
          targetType: 'task',
          targetId: updated.taskKey,
          meta: {
            tokenId: auth.tokenId,
            tokenName: auth.tokenName,
            lifecycleAction: lifecycleAction ?? null,
            fromStatus,
            toStatus,
            changedFields,
          },
        },
        client,
      );

      await writeOutboxEventStandalone(
        {
          ownerId: auth.ownerId,
          projectId: updated.projectId,
          eventType: statusChanged ? TASK_STATUS_CHANGED : TASK_UPDATED,
          entityType: ENTITY_TASK,
          entityId: updated.taskKey,
          payload: statusChanged ? { from: fromStatus, to: toStatus } : { changedFields },
        },
        client,
      );

      const available_labels = await fetchAvailableLabels(auth.ownerId, updated.projectId, client);

      return NextResponse.json({
        task: serializePreqTask(
          {
            id: updated.id,
            taskKey: updated.taskKey,
            taskPrefix: updated.taskPrefix,
            taskNumber: updated.taskNumber,
            title: updated.title,
            note: updated.note,
            status: updated.status,
            taskPriority: updated.taskPriority,
            branch: updated.branch ?? null,
            engine: updated.engine ?? null,
            dispatchTarget: updated.dispatchTarget ?? null,
            runState: coerceTaskRunState(updated.runState),
            runStateUpdatedAt: updated.runStateUpdatedAt ?? null,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            project: updated.project
              ? {
                  repoUrl: updated.project.repoUrl,
                  settings: updated.project.projectSettings,
                }
              : null,
            labels: extractTaskLabels(updated).map((label) => ({ name: label.name })),
          },
          auth.ownerEmail,
        ),
        available_labels,
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if (isTaskKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'Task ID already exists. Choose another ID.' },
        { status: 409 },
      );
    }
    console.error(
      '[tasks.patch] failed:',
      {
        taskId,
        lifecycleAction: lifecycleAction ?? null,
        requestedStatus,
        existingStatus,
        hasResult,
        hasBranch,
      },
      error,
    );
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    return await withOwnerDb(auth.ownerId, async (client) => {
      const existing = await client.query.tasks.findFirst({
        where: taskWhereByIdentifier(auth.ownerId, id),
        columns: { id: true, taskKey: true, projectId: true },
      });

      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await client.delete(tasks).where(eq(tasks.id, existing.id));
      await writeOutboxEvent({
        tx: client,
        ownerId: auth.ownerId,
        projectId: existing.projectId,
        eventType: TASK_DELETED,
        entityType: ENTITY_TASK,
        entityId: existing.taskKey,
      });

      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: 'task.deleted.via_api_token',
          targetType: 'task',
          targetId: normalizeTaskIdentifier(id),
          meta: { tokenId: auth.tokenId, tokenName: auth.tokenName },
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
