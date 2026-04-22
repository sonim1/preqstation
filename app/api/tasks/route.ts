import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { TODO_NOTE_MAX_LENGTH, TODO_TITLE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabelAssignments, tasks } from '@/lib/db/schema';
import { ENGINE_KEYS, normalizeEngineKey } from '@/lib/engine-icons';
import { ENTITY_TASK, TASK_CREATED, writeOutboxEvent } from '@/lib/outbox';
import {
  buildTaskNote,
  fetchAvailableLabels,
  generateBranchName,
  normalizePreqTaskLabelNames,
  normalizeTaskPriority,
  PREQ_TASK_STATUSES,
  resolveOrCreateLabelId,
  resolveProjectByRepo,
  serializePreqTask,
  toInternalTaskStatus,
  toPreqTaskDispatchTarget,
  toPreqTaskRunState,
  toPreqTaskStatus,
} from '@/lib/preq-task';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import { isTaskKeyUniqueConstraintError, resolveNextTaskKey } from '@/lib/task-keys';
import { extractTaskLabels } from '@/lib/task-labels';
import { coerceTaskRunState, isTaskStatus, parseTaskPriority } from '@/lib/task-meta';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import { resolveAppendSortOrder, TASK_BOARD_ORDER } from '@/lib/task-sort-order';

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH),
  description: z.string().trim().max(TODO_NOTE_MAX_LENGTH).optional().or(z.literal('')),
  status: z.enum(PREQ_TASK_STATUSES).optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  repo: z.string().trim().min(1),
  branch: z.string().trim().optional().or(z.literal('')),
  labels: z.array(z.string().trim().min(1).max(40)).optional(),
  acceptance_criteria: z.array(z.string().trim().min(1).max(200)).optional(),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
});

function parseProjectKeyFilter(raw: string | null) {
  if (raw === null) return null;
  const normalized = raw.trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(normalized)) {
    return false;
  }
  return normalized;
}

function parseLimit(raw: string | null) {
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  return Math.min(Math.trunc(parsed), 200);
}

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status')?.trim();
    const labelFilter = searchParams.get('label')?.trim();
    const engineFilter = normalizeEngineKey(searchParams.get('engine'));
    const runStateFilter = coerceTaskRunState(searchParams.get('run_state'));
    const dispatchTargetFilter = normalizeTaskDispatchTarget(searchParams.get('dispatch_target'));
    const projectKeyFilter = parseProjectKeyFilter(searchParams.get('project_key'));
    const queryLimit = parseLimit(searchParams.get('limit'));
    const compact = searchParams.get('compact') === '1';

    if (statusFilter && !isTaskStatus(statusFilter)) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    if (searchParams.has('engine') && !engineFilter) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    if (searchParams.has('run_state') && !runStateFilter) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    if (searchParams.has('dispatch_target') && !dispatchTargetFilter) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    if (searchParams.has('project_key') && projectKeyFilter === false) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    if (searchParams.has('limit') && queryLimit === false) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const conditions = [
      eq(tasks.ownerId, auth.ownerId),
      or(
        isNull(tasks.projectId),
        sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
      ),
    ];

    if (statusFilter) {
      conditions.push(eq(tasks.status, statusFilter));
    }

    if (labelFilter) {
      conditions.push(
        sql`EXISTS (
          SELECT 1
          FROM task_label_assignments tla
          INNER JOIN task_labels tl ON tl.id = tla.label_id
          WHERE tla.task_id = ${tasks.id} AND tl.name = ${labelFilter}
        )`,
      );
    }
    if (engineFilter) {
      conditions.push(eq(tasks.engine, engineFilter));
    }
    if (runStateFilter) {
      conditions.push(eq(tasks.runState, runStateFilter));
    }
    if (dispatchTargetFilter) {
      conditions.push(eq(tasks.dispatchTarget, dispatchTargetFilter));
    }
    if (projectKeyFilter) {
      conditions.push(eq(tasks.taskPrefix, projectKeyFilter));
    }

    return await withOwnerDb(auth.ownerId, async (client) => {
      if (compact) {
        const todos = await client.query.tasks.findMany({
          where: and(...conditions),
          orderBy: TASK_BOARD_ORDER,
          limit: queryLimit || undefined,
          columns: {
            id: true,
            taskKey: true,
            title: true,
            status: true,
            taskPriority: true,
            branch: true,
            engine: true,
            dispatchTarget: true,
            runState: true,
            runStateUpdatedAt: true,
            updatedAt: true,
          },
          with: {
            project: {
              columns: { repoUrl: true },
            },
            labelAssignments: {
              columns: { position: true },
              orderBy: [asc(taskLabelAssignments.position)],
              with: {
                label: {
                  columns: { id: true, name: true },
                },
              },
            },
          },
        });

        return NextResponse.json({
          tasks: todos.map((todo) => ({
            id: todo.taskKey,
            task_key: todo.taskKey,
            title: todo.title,
            status: toPreqTaskStatus(todo.status),
            run_state: toPreqTaskRunState(coerceTaskRunState(todo.runState)),
            run_state_updated_at: todo.runStateUpdatedAt?.toISOString() ?? null,
            priority: parseTaskPriority(todo.taskPriority),
            repo: todo.project?.repoUrl ?? null,
            engine: todo.engine ?? null,
            branch_name: todo.branch ?? null,
            dispatch_target: toPreqTaskDispatchTarget(todo.dispatchTarget),
            labels: extractTaskLabels(todo).map((label) => label.name),
            updated_at: todo.updatedAt.toISOString(),
          })),
        });
      }

      const todos = await client.query.tasks.findMany({
        where: and(...conditions),
        orderBy: TASK_BOARD_ORDER,
        limit: queryLimit || undefined,
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

      const taskList = todos.map((todo) =>
        serializePreqTask(
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
      );

      let available_labels: Array<{ name: string; color: string | null }> = [];
      if (projectKeyFilter) {
        const project = await client.query.projects.findFirst({
          where: and(
            eq(projects.ownerId, auth.ownerId),
            eq(projects.projectKey, projectKeyFilter),
            isNull(projects.deletedAt),
          ),
          columns: { id: true },
        });
        available_labels = await fetchAvailableLabels(auth.ownerId, project?.id ?? null, client);
      }

      return NextResponse.json({ tasks: taskList, available_labels });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Record<string, unknown>;
    if ('id' in body || 'taskKey' in body || 'taskPrefix' in body || 'taskNumber' in body) {
      return NextResponse.json(
        { error: 'Task ID is auto-generated and cannot be set manually.' },
        { status: 400 },
      );
    }
    const payload = createTaskSchema.parse(body);

    return await withOwnerDb(auth.ownerId, async (client) => {
      const project = await resolveProjectByRepo(auth.ownerId, payload.repo, client);
      if (!project) {
        return NextResponse.json(
          { error: 'No project found for the given repo.' },
          { status: 400 },
        );
      }

      const labelNames = normalizePreqTaskLabelNames(payload.labels);
      const labelIds = (
        await Promise.all(
          labelNames.map((labelName) =>
            resolveOrCreateLabelId(auth.ownerId, project.id, labelName, client),
          ),
        )
      ).filter((labelId): labelId is string => Boolean(labelId));
      const primaryLabelId = labelIds[0] ?? null;

      const taskKeyParts = await resolveNextTaskKey({
        ownerId: auth.ownerId,
        taskPrefix: project.projectKey,
        db: client,
      });

      const todoStatus = toInternalTaskStatus(payload.status) || 'inbox';
      const branch =
        payload.branch?.trim() || generateBranchName(taskKeyParts.taskKey, payload.title);
      const engine = payload.engine || null;
      const sortOrder = await resolveAppendSortOrder({
        client,
        ownerId: auth.ownerId,
        status: todoStatus,
      });

      const [todo] = await client
        .insert(tasks)
        .values({
          ownerId: auth.ownerId,
          taskKey: taskKeyParts.taskKey,
          taskPrefix: taskKeyParts.taskPrefix,
          taskNumber: taskKeyParts.taskNumber,
          title: payload.title,
          note: buildTaskNote(payload.description || '', payload.acceptance_criteria),
          status: todoStatus,
          taskPriority: normalizeTaskPriority(payload.priority),
          branch,
          engine: engine || null,
          ...buildTaskRunStateUpdate(null),
          projectId: project.id,
          labelId: primaryLabelId,
          sortOrder,
          ...(todoStatus === 'archived' ? { archivedAt: new Date() } : {}),
        })
        .returning();

      if (labelIds.length > 0) {
        await client.insert(taskLabelAssignments).values(
          labelIds.map((labelId, position) => ({
            taskId: todo.id,
            labelId,
            position,
          })),
        );
      }

      await writeOutboxEvent({
        tx: client,
        ownerId: auth.ownerId,
        projectId: project.id,
        eventType: TASK_CREATED,
        entityType: ENTITY_TASK,
        entityId: todo.taskKey,
        payload: { title: payload.title, status: todoStatus },
      });

      const createdWithRelations = await client.query.tasks.findFirst({
        where: eq(tasks.id, todo.id),
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

      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: 'task.created.via_api_token',
          targetType: 'task',
          targetId: todo.taskKey,
          meta: { tokenId: auth.tokenId, tokenName: auth.tokenName },
        },
        client,
      );

      const available_labels = await fetchAvailableLabels(auth.ownerId, project.id, client);

      return NextResponse.json(
        {
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
              createdAt: todo.createdAt,
              updatedAt: todo.updatedAt,
              project: createdWithRelations?.project
                ? {
                    repoUrl: createdWithRelations.project.repoUrl,
                    settings: createdWithRelations.project.projectSettings,
                  }
                : null,
              labels: extractTaskLabels(createdWithRelations).map((label) => ({
                name: label.name,
              })),
            },
            auth.ownerEmail,
          ),
          available_labels,
        },
        { status: 201 },
      );
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
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
