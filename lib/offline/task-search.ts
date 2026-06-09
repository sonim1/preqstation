import { allStatuses, type KanbanColumns, type KanbanTask } from '@/lib/kanban-helpers';
import { type OfflineSnapshotRecord, openOfflineDb } from '@/lib/offline/db';

export type OfflineTaskSearchHit = {
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

type BoardSnapshotPayload = {
  columns?: Partial<KanbanColumns>;
};

const DEFAULT_SEARCH_LIMIT = 8;

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function taskMatchesQuery(task: KanbanTask, query: string) {
  const haystack = [
    task.taskKey,
    task.title,
    task.status,
    task.project?.name,
    task.project?.projectKey,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function taskToHit(task: KanbanTask): OfflineTaskSearchHit | null {
  if (!task.project?.id || !task.project.projectKey) {
    return null;
  }

  return {
    taskId: task.id,
    taskKey: task.taskKey,
    title: task.title,
    status: task.status,
    project: {
      id: task.project.id,
      name: task.project.name,
      projectKey: task.project.projectKey,
    },
  };
}

function collectBoardTasks(snapshot: OfflineSnapshotRecord): KanbanTask[] {
  if (snapshot.kind !== 'board') {
    return [];
  }

  const payload = snapshot.payload as BoardSnapshotPayload | null;
  if (!payload?.columns) {
    return [];
  }

  return allStatuses.flatMap((status) => payload.columns?.[status] ?? []);
}

export async function searchOfflineTaskSnapshots(query: string, limit = DEFAULT_SEARCH_LIMIT) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const db = await openOfflineDb();
  const snapshots = await db.getAll('snapshots');
  const newestSnapshots = [...snapshots].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const hits: OfflineTaskSearchHit[] = [];
  const seenTaskKeys = new Set<string>();

  for (const snapshot of newestSnapshots) {
    for (const task of collectBoardTasks(snapshot)) {
      if (seenTaskKeys.has(task.taskKey) || !taskMatchesQuery(task, normalizedQuery)) {
        continue;
      }

      const hit = taskToHit(task);
      if (!hit) {
        continue;
      }

      seenTaskKeys.add(task.taskKey);
      hits.push(hit);
      if (hits.length >= limit) {
        return hits;
      }
    }
  }

  return hits;
}
