import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withOwnerDb } from '@/lib/db/rls';
import { taskLabelAssignments, tasks } from '@/lib/db/schema';
import { toKanbanTask } from '@/lib/kanban-helpers';
import { requireOwnerUser } from '@/lib/owner';

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerUser();
    const { searchParams } = new URL(request.url);
    const taskKeys = [...new Set(searchParams.getAll('taskKey').filter(Boolean))];
    const projectId = searchParams.get('projectId');

    if (taskKeys.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    return await withOwnerDb(owner.id, async (client) => {
      const rows = await client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, owner.id),
          inArray(tasks.taskKey, taskKeys),
          projectId ? eq(tasks.projectId, projectId) : undefined,
        ),
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
        },
      });

      return NextResponse.json({
        tasks: rows.map((task) =>
          toKanbanTask(task, task.status as Parameters<typeof toKanbanTask>[1]),
        ),
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load task snapshots' }, { status: 500 });
  }
}
