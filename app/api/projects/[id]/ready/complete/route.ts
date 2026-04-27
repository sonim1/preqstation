import { and, asc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabelAssignments, tasks } from '@/lib/db/schema';
import { computeSortOrder, type KanbanTask } from '@/lib/kanban-helpers';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { extractTaskLabels } from '@/lib/task-labels';
import { applyBoardTaskStatusTransition } from '@/lib/task-status-transition';

function buildProjectedDoneTask(id: string, sortOrder: string): KanbanTask {
  return {
    id,
    taskKey: id,
    branch: null,
    title: '',
    note: null,
    status: 'done',
    sortOrder,
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date(0).toISOString(),
    archivedAt: null,
    labels: [],
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;

    return withOwnerDb(owner.id, async (client) => {
      const project = await client.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.ownerId, owner.id), isNull(projects.deletedAt)),
        columns: { id: true, name: true, projectKey: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const readyTasks = await client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, owner.id),
          eq(tasks.projectId, project.id),
          eq(tasks.status, 'ready'),
        ),
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
        orderBy: [asc(tasks.sortOrder), asc(tasks.createdAt)],
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
      if (readyTasks.length === 0) {
        return NextResponse.json({ error: 'No ready tasks available' }, { status: 400 });
      }

      const doneTasks = await client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, owner.id),
          eq(tasks.projectId, project.id),
          eq(tasks.status, 'done'),
        ),
        columns: { id: true, sortOrder: true },
        orderBy: [asc(tasks.sortOrder), asc(tasks.createdAt)],
      });

      const projectedDoneTasks = doneTasks.map((task) =>
        buildProjectedDoneTask(task.id, task.sortOrder),
      );
      const movedTasks: KanbanTask[] = [];
      const now = new Date();

      for (const readyTask of readyTasks) {
        const nextSortOrder = computeSortOrder(projectedDoneTasks, projectedDoneTasks.length);
        const movedTask = await applyBoardTaskStatusTransition({
          tx: client,
          ownerId: owner.id,
          projectId: project.id,
          existingTask: readyTask,
          nextTask: {
            title: readyTask.title,
            note: readyTask.note,
            status: 'done',
            sortOrder: nextSortOrder,
            taskPriority: readyTask.taskPriority,
            dueAt: readyTask.dueAt,
            labelId: readyTask.labelId,
            labels: extractTaskLabels(readyTask),
          },
          now,
        });
        movedTasks.push(movedTask);
        projectedDoneTasks.push(movedTask);
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'task.batch_completed',
          targetType: 'project',
          targetId: project.id,
          meta: {
            projectId: project.id,
            projectKey: project.projectKey,
            count: movedTasks.length,
            fromStatus: 'ready',
            toStatus: 'done',
          },
        },
        client,
      );

      return NextResponse.json({
        ok: true,
        movedCount: movedTasks.length,
        movedTasks,
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[api/projects/:id/ready/complete] POST failed:', error);
    return NextResponse.json({ error: 'Failed to move ready tasks' }, { status: 500 });
  }
}
