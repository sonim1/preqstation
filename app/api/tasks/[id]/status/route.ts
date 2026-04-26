import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, tasks, workLogs } from '@/lib/db/schema';
import { ENGINE_KEYS } from '@/lib/engine-icons';
import {
  ENTITY_TASK,
  ENTITY_WORKLOG,
  TASK_STATUS_CHANGED,
  WORKLOG_CREATED,
  writeOutboxEventStandalone,
} from '@/lib/outbox';
import { serializePreqTask } from '@/lib/preq-task';
import { resolveDeployStrategyConfig } from '@/lib/project-settings';
import { normalizeTaskIdentifier, taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels } from '@/lib/task-labels';
import { coerceTaskRunState, TASK_STATUSES } from '@/lib/task-meta';
import { safeCreateTaskCompletionNotification } from '@/lib/task-notifications';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import { buildTaskStatusChangeWorkLog } from '@/lib/task-worklog';

const updateTaskStatusSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  })
  .strict();

function readStoredPrUrl(detail: string | null | undefined) {
  if (!detail) return '';
  const match = detail.match(/\*\*PR:\*\*\s+\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/);
  return (match?.[2] || match?.[1] || '').trim();
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
    `Push the branch, create a PR targeting ${params.defaultBranch} via GitHub MCP or \`gh pr create\`, then retry \`preq_complete_task\` with \`branchName\` and a PR URL so the result payload includes the PR URL.`,
  ].join(' ');
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const payload = updateTaskStatusSchema.parse((await req.json()) as Record<string, unknown>);

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

      const now = new Date();
      const nextStatus = payload.status;
      const deployStrategy = resolveDeployStrategyConfig(existing.project?.projectSettings);
      const requiresPullRequestBeforeReady =
        nextStatus === 'ready' &&
        existing.status !== 'ready' &&
        deployStrategy.strategy === 'feature_branch' &&
        deployStrategy.auto_pr &&
        deployStrategy.commit_on_review;

      if (requiresPullRequestBeforeReady) {
        const latestPreqResultLog = await client.query.workLogs.findFirst({
          where: and(
            eq(workLogs.ownerId, auth.ownerId),
            eq(workLogs.taskId, existing.id),
            like(workLogs.title, 'PREQSTATION Result%'),
          ),
          orderBy: [desc(workLogs.workedAt), desc(workLogs.createdAt)],
          columns: { detail: true },
        });
        const resolvedBranchName = (existing.branch ?? '').trim();
        const storedPrUrl = readStoredPrUrl(latestPreqResultLog?.detail);

        if (!resolvedBranchName || !storedPrUrl) {
          return NextResponse.json(
            {
              error: buildAutoPrCompletionError({
                defaultBranch: deployStrategy.default_branch || 'main',
                missingBranch: !resolvedBranchName,
                missingPrUrl: !storedPrUrl,
              }),
            },
            { status: 409 },
          );
        }
      }

      const nextEngine: string | null | undefined =
        payload.engine !== undefined ? payload.engine || null : undefined;

      const updateData: Record<string, unknown> = {
        status: nextStatus,
        ...buildTaskRunStateUpdate(null, now),
        ...(nextStatus === 'archived'
          ? { archivedAt: now }
          : existing.status === 'archived'
            ? { archivedAt: null }
            : {}),
      };
      if (nextEngine !== undefined) updateData.engine = nextEngine;

      await client.update(tasks).set(updateData).where(eq(tasks.id, existing.id));

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

      const fromStatus = existing.status;
      const toStatus = nextStatus;
      const statusChanged = fromStatus !== toStatus;

      if (statusChanged) {
        const statusLog = buildTaskStatusChangeWorkLog({
          taskKey: updated.taskKey,
          taskTitle: updated.title,
          fromStatus,
          toStatus,
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

        await writeOutboxEventStandalone(
          {
            ownerId: auth.ownerId,
            projectId: updated.projectId,
            eventType: TASK_STATUS_CHANGED,
            entityType: ENTITY_TASK,
            entityId: updated.taskKey,
            payload: { from: fromStatus, to: toStatus },
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
        fromStatus,
        toStatus,
        previousRunState: existing.runState,
        nextRunState: updated.runState,
      });

      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: 'task.status.updated.via_api_token',
          targetType: 'task',
          targetId: normalizeTaskIdentifier(id),
          meta: {
            tokenId: auth.tokenId,
            tokenName: auth.tokenName,
            fromStatus,
            toStatus,
          },
        },
        client,
      );

      const serialized = serializePreqTask(
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
      );

      return NextResponse.json({
        task: {
          ...serialized,
          status: updated.status,
        },
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
  }
}
