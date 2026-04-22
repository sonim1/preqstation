import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import {
  TODO_NOTE_MAX_LENGTH,
  TODO_SORT_ORDER_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from '@/lib/content-limits';
import { getDayRangeForTimeZone } from '@/lib/date-time';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, tasks } from '@/lib/db/schema';
import { type KanbanTask } from '@/lib/kanban-helpers';
import { ENTITY_TASK, TASK_CREATED, writeOutboxEvent } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { generateBranchName } from '@/lib/preq-task';
import { assertSameOrigin } from '@/lib/request-security';
import { isTaskKeyUniqueConstraintError, resolveNextTaskKey } from '@/lib/task-keys';
import {
  normalizeTaskLabelIds,
  resolveProjectTaskLabels,
  syncTaskLabelAssignments,
} from '@/lib/task-labels';
import { TASK_PRIORITIES } from '@/lib/task-meta';
import { resolveAppendSortOrder, TASK_BOARD_ORDER } from '@/lib/task-sort-order';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH),
  note: z.string().trim().max(TODO_NOTE_MAX_LENGTH).optional().or(z.literal('')),
  projectId: z.string().uuid(),
  labelIds: z.array(z.string().uuid()).optional(),
  dueAt: z.string().datetime().optional().or(z.literal('')),
  sortOrder: z.string().max(TODO_SORT_ORDER_MAX_LENGTH).optional(),
  taskPriority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(['inbox', 'todo', 'hold', 'ready', 'done', 'archived']).optional(),
});

function toCreatedBoardTask(params: {
  todo: { id: string; taskKey: string; projectId: string | null };
  branch: string;
  title: string;
  note: string | null;
  status: 'inbox' | 'todo' | 'hold' | 'ready' | 'done' | 'archived';
  sortOrder: string;
  taskPriority: string;
  dueAt: string | null;
  project: { id: string; name: string; projectKey: string };
  labels: Array<{ id: string; name: string; color?: string | null }>;
}): KanbanTask {
  return {
    id: params.todo.id,
    taskKey: params.todo.taskKey,
    branch: params.branch,
    title: params.title,
    note: params.note,
    status: params.status,
    sortOrder: params.sortOrder,
    taskPriority: params.taskPriority,
    dueAt: params.dueAt,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: {
      id: params.project.id,
      name: params.project.name,
      projectKey: params.project.projectKey,
    },
    updatedAt: new Date().toISOString(),
    archivedAt: params.status === 'archived' ? new Date().toISOString() : null,
    labels: params.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? 'blue',
    })),
  };
}

export async function GET(req: Request) {
  try {
    const owner = await requireOwnerUser();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') ?? 'all';

    return await withOwnerDb(owner.id, async (client) => {
      const conditions = [
        eq(tasks.ownerId, owner.id),
        or(
          isNull(tasks.projectId),
          sql`EXISTS (SELECT 1 FROM projects WHERE projects.id = ${tasks.projectId} AND projects.deleted_at IS NULL)`,
        ),
      ];

      if (scope === 'today') {
        const timeZone = await getUserSetting(owner.id, SETTING_KEYS.TIMEZONE, client);
        const dayRange = getDayRangeForTimeZone(timeZone);

        conditions.push(eq(tasks.status, 'todo'));
        conditions.push(gte(tasks.dueAt, dayRange.start));
        conditions.push(lt(tasks.dueAt, dayRange.end));
      }

      const todos = await client.query.tasks.findMany({
        where: and(...conditions),
        orderBy: TASK_BOARD_ORDER,
        with: {
          project: {
            columns: { id: true, name: true },
          },
          label: {
            columns: { id: true, name: true, color: true },
          },
        },
      });

      return NextResponse.json({ todos });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load todos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const body = (await req.json()) as Record<string, unknown>;
    if ('taskKey' in body || 'taskPrefix' in body || 'taskNumber' in body) {
      return NextResponse.json(
        { error: 'Task ID is auto-generated and cannot be set manually.' },
        { status: 400 },
      );
    }
    if ('labelId' in body) {
      return NextResponse.json(
        { error: 'labelId is no longer supported. Use labelIds.' },
        { status: 400 },
      );
    }
    const payload = createTodoSchema.parse(body);

    return await withOwnerDb(owner.id, async (client) => {
      const project = await client.query.projects.findFirst({
        where: and(
          eq(projects.id, payload.projectId),
          eq(projects.ownerId, owner.id),
          isNull(projects.deletedAt),
        ),
        columns: { id: true, name: true, projectKey: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
      }

      const requestedLabelIds = normalizeTaskLabelIds(payload.labelIds);
      const resolvedLabels = await resolveProjectTaskLabels(
        owner.id,
        project.id,
        requestedLabelIds,
        client,
      );
      if (resolvedLabels.length !== requestedLabelIds.length) {
        return NextResponse.json(
          { error: requestedLabelIds.length > 1 ? 'Invalid labelIds' : 'Invalid labelId' },
          { status: 400 },
        );
      }
      const labelIds = resolvedLabels.map((label) => label.id);
      const primaryLabelId = labelIds[0] ?? null;

      const taskKeyParts = await resolveNextTaskKey({
        ownerId: owner.id,
        taskPrefix: project.projectKey,
        db: client,
      });

      const requestedStatus = payload.status;
      const validStatuses = ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'] as const;
      const status =
        requestedStatus && validStatuses.includes(requestedStatus) ? requestedStatus : 'inbox';
      const branch = generateBranchName(taskKeyParts.taskKey, payload.title);

      let sortOrder = payload.sortOrder;
      if (!sortOrder) {
        sortOrder = await resolveAppendSortOrder({
          client,
          ownerId: owner.id,
          status,
        });
      }

      const [todo] = await client
        .insert(tasks)
        .values({
          ownerId: owner.id,
          projectId: project.id,
          labelId: primaryLabelId,
          taskKey: taskKeyParts.taskKey,
          taskPrefix: taskKeyParts.taskPrefix,
          taskNumber: taskKeyParts.taskNumber,
          title: payload.title,
          note: payload.note || null,
          dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
          status: status,
          branch,
          sortOrder,
          taskPriority: payload.taskPriority ?? 'none',
          ...(status === 'archived' ? { archivedAt: new Date() } : {}),
        })
        .returning();

      await syncTaskLabelAssignments(client, todo.id, labelIds);

      await writeOutboxEvent({
        tx: client,
        ownerId: owner.id,
        projectId: project.id,
        eventType: TASK_CREATED,
        entityType: ENTITY_TASK,
        entityId: todo.taskKey,
        payload: { title: payload.title, status },
      });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'task.created',
          targetType: 'task',
          targetId: todo.taskKey,
          meta: {
            projectId: todo.projectId,
            labelId: todo.labelId,
            labelIds,
            taskPriority: todo.taskPriority,
          },
        },
        client,
      );

      return NextResponse.json(
        {
          todo,
          boardTask: toCreatedBoardTask({
            todo,
            branch,
            title: payload.title,
            note: payload.note || null,
            status,
            sortOrder,
            taskPriority: payload.taskPriority ?? 'none',
            dueAt: payload.dueAt || null,
            project,
            labels: resolvedLabels,
          }),
        },
        { status: 201 },
      );
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if (isTaskKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'Task ID already exists. Choose another ID.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
