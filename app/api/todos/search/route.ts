import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withOwnerDb } from '@/lib/db/rls';
import { tasks } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { searchTasksForBoard } from '@/lib/task-search';

type TaskSearchHit = {
  taskId: string;
  taskKey: string;
  title: string;
  status: string;
  project: {
    id: string;
    name: string;
    projectKey: string;
  } | null;
};

export async function GET(req: Request) {
  try {
    const owner = await requireOwnerUser();
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') ?? '').trim();
    const projectId = searchParams.get('projectId')?.trim() || null;

    if (!query) {
      return NextResponse.json({
        query: '',
        total: 0,
        results: [],
      });
    }

    return await withOwnerDb(owner.id, async (client) => {
      const rankedResults = await searchTasksForBoard({
        ownerId: owner.id,
        query,
        projectId,
        client,
      });

      if (rankedResults.length === 0) {
        return NextResponse.json({
          query,
          total: 0,
          results: [],
        });
      }

      const rankedTaskIds = rankedResults.map((result) => result.taskId);
      const orderByTaskId = new Map(rankedTaskIds.map((taskId, index) => [taskId, index]));

      const records = await client.query.tasks.findMany({
        where: inArray(tasks.id, rankedTaskIds),
        with: {
          project: { columns: { id: true, name: true, projectKey: true } },
        },
      });

      const results = [...records]
        .sort(
          (left, right) =>
            (orderByTaskId.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (orderByTaskId.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        )
        .map(
          (record): TaskSearchHit => ({
            taskId: record.id,
            taskKey: record.taskKey,
            title: record.title,
            status: record.status,
            project: record.project
              ? {
                  id: record.project.id,
                  name: record.project.name,
                  projectKey: record.project.projectKey,
                }
              : null,
          }),
        );

      return NextResponse.json({
        query,
        total: rankedResults.length,
        results,
      });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to search todos' }, { status: 500 });
  }
}
