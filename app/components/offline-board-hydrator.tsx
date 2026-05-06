'use client';

import { useEffect } from 'react';

import {
  useFocusedTask,
  useHydrateKanbanStore,
  useKanbanColumns,
} from '@/app/components/kanban-store-provider';
import { allStatuses, type KanbanColumns, type KanbanTask } from '@/lib/kanban-helpers';
import type { KanbanHydrationSnapshot } from '@/lib/kanban-store';
import {
  buildOptimisticTasksFromQueuedCreates,
  listQueuedOfflineMutations,
} from '@/lib/offline/mutation-store';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

type OfflineBoardHydratorProps = {
  boardKey: string;
};

function buildProjectsById(
  columns: KanbanColumns,
  queuedMutations: Awaited<ReturnType<typeof listQueuedOfflineMutations>>,
  boardKey: string,
) {
  const projectsById: Record<string, { id: string; name: string; projectKey: string }> = {};

  for (const status of allStatuses) {
    for (const task of columns[status]) {
      if (task.project?.id) {
        projectsById[task.project.id] = task.project;
      }
    }
  }

  for (const mutation of queuedMutations) {
    if (mutation.kind === 'create' && !projectsById[mutation.payload.projectId]) {
      projectsById[mutation.payload.projectId] = {
        id: mutation.payload.projectId,
        name: 'Project',
        projectKey: boardKey,
      };
    }
  }

  return projectsById;
}

function mergeQueuedCreatesIntoColumns(columns: KanbanColumns, queuedCreateTasks: KanbanTask[]) {
  if (queuedCreateTasks.length === 0) {
    return columns;
  }

  const existingTaskKeys = new Set<string>();
  for (const status of allStatuses) {
    for (const task of columns[status]) {
      existingTaskKeys.add(task.taskKey);
    }
  }

  const nextColumns: KanbanColumns = {
    inbox: [...columns.inbox],
    todo: [...columns.todo],
    hold: [...columns.hold],
    ready: [...columns.ready],
    done: [...columns.done],
    archived: [...columns.archived],
  };

  for (const task of queuedCreateTasks) {
    if (existingTaskKeys.has(task.taskKey)) {
      continue;
    }

    nextColumns[task.status] = [...nextColumns[task.status], task];
  }

  return nextColumns;
}

export function OfflineBoardHydrator({ boardKey }: OfflineBoardHydratorProps) {
  const columns = useKanbanColumns();
  const focusedTask = useFocusedTask();
  const hydrate = useHydrateKanbanStore();

  useEffect(() => {
    let cancelled = false;

    void listQueuedOfflineMutations().then((queuedMutations) => {
      if (cancelled) {
        return;
      }

      const queuedCreateTasks = buildOptimisticTasksFromQueuedCreates(
        queuedMutations,
        buildProjectsById(columns, queuedMutations, boardKey),
      );
      const snapshotColumns = mergeQueuedCreatesIntoColumns(columns, queuedCreateTasks);

      return putSnapshot({
        id: `board:${boardKey}`,
        kind: 'board',
        entityKey: boardKey,
        payload: {
          columns: snapshotColumns,
          focusedTask,
        },
        updatedAt: new Date().toISOString(),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [boardKey, columns, focusedTask]);

  useEffect(() => {
    if (navigator.onLine) {
      return;
    }

    void getSnapshot<KanbanHydrationSnapshot>(`board:${boardKey}`).then((snapshot) => {
      if (!snapshot?.payload) {
        return;
      }

      hydrate(snapshot.payload);
    });
  }, [boardKey, hydrate]);

  return null;
}
