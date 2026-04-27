import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, tasks } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { taskWhereByIdentifier } from '@/lib/task-keys';
import { extractTaskLabels } from '@/lib/task-label-utils';
import { TASK_STATUSES, type TaskStatus } from '@/lib/task-meta';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import { type LaneTaskRow, resolveMoveIntentPlacement } from '@/lib/task-sort-order';
import { applyBoardTaskStatusTransition } from '@/lib/task-status-transition';

const moveTodoSchema = z.object({
  taskKey: z.string().trim().min(1),
  targetStatus: z.enum(TASK_STATUSES),
  afterTaskKey: z.string().trim().min(1).optional().nullable(),
  beforeTaskKey: z.string().trim().min(1).optional().nullable(),
});

function toLaneOrderPatches(rows: LaneTaskRow[], status: TaskStatus) {
  return rows.flatMap((row) =>
    row.taskKey
      ? [
          {
            taskKey: row.taskKey,
            status,
            sortOrder: row.sortOrder,
          },
        ]
      : [],
  );
}

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = moveTodoSchema.parse((await req.json()) as Record<string, unknown>);

    return await withOwnerDb(owner.id, async (client) => {
      const existing = await client.query.tasks.findFirst({
        where: taskWhereByIdentifier(owner.id, payload.taskKey),
        columns: {
          id: true,
          taskKey: true,
          branch: true,
          title: true,
          note: true,
          status: true,
          sortOrder: true,
          taskPriority: true,
          dueAt: true,
          engine: true,
          dispatchTarget: true,
          runState: true,
          runStateUpdatedAt: true,
          archivedAt: true,
          updatedAt: true,
          projectId: true,
          labelId: true,
        },
        with: {
          project: { columns: { id: true, name: true, projectKey: true } },
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: { columns: { id: true, name: true, color: true } },
            },
          },
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const { sortOrder, sourceRows, targetRows } = await resolveMoveIntentPlacement({
        client,
        ownerId: owner.id,
        taskId: existing.id,
        fromStatus: existing.status as TaskStatus,
        targetStatus: payload.targetStatus,
        afterTaskKey: payload.afterTaskKey ?? null,
        beforeTaskKey: payload.beforeTaskKey ?? null,
      });

      const statusChanged = existing.status !== payload.targetStatus;
      const boardTask = statusChanged
        ? await applyBoardTaskStatusTransition({
            tx: client,
            ownerId: owner.id,
            projectId: existing.projectId,
            existingTask: existing,
            nextTask: {
              title: existing.title,
              note: existing.note,
              status: payload.targetStatus,
              sortOrder,
              taskPriority: existing.taskPriority,
              dueAt: existing.dueAt,
              labelId: existing.labelId,
              labels: extractTaskLabels(existing),
            },
          })
        : null;

      const nextArchivedAt = payload.targetStatus === 'archived' ? new Date() : null;
      if (!statusChanged) {
        await client
          .update(tasks)
          .set({
            status: payload.targetStatus,
            sortOrder,
            archivedAt: nextArchivedAt,
            ...buildTaskRunStateUpdate(null),
          })
          .where(eq(tasks.id, existing.id));
      }

      return NextResponse.json({
        ok: true,
        boardTask: boardTask ?? {
          taskKey: existing.taskKey,
          status: payload.targetStatus,
          sortOrder,
          archivedAt: nextArchivedAt ? nextArchivedAt.toISOString() : null,
        },
        repairedTasks: [
          ...toLaneOrderPatches(sourceRows, existing.status as TaskStatus),
          ...toLaneOrderPatches(targetRows, payload.targetStatus),
        ],
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[todos.move] failed:', error);
    return NextResponse.json({ error: 'Failed to move todo' }, { status: 500 });
  }
}
