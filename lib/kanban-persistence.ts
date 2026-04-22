import {
  allStatuses,
  buildUpdates,
  type KanbanColumns,
  type KanbanTask,
} from '@/lib/kanban-helpers';
import { parseChecklistCounts } from '@/lib/utils/task-utils';

export type QueuedKanbanMutation = {
  run: () => Promise<void>;
};

export async function drainKanbanMutationQueue(queue: QueuedKanbanMutation[]) {
  while (queue.length > 0) {
    const mutation = queue[0];
    await mutation.run();
    queue.shift();
  }
}

export function shouldApplyKanbanServerSnapshot(params: {
  isPersisting: boolean;
  queuedCount: number;
}) {
  return !params.isPersisting && params.queuedCount === 0;
}

function hasSameKanbanChecklist(left: KanbanTask, right: KanbanTask) {
  const leftChecklist = parseChecklistCounts(left.note);
  const rightChecklist = parseChecklistCounts(right.note);

  if (!leftChecklist || !rightChecklist) {
    return leftChecklist === rightChecklist;
  }

  return leftChecklist.done === rightChecklist.done && leftChecklist.total === rightChecklist.total;
}

function hasSameKanbanLabels(left: KanbanTask, right: KanbanTask) {
  if (left.labels.length !== right.labels.length) return false;

  return left.labels.every((label, index) => {
    const next = right.labels[index];
    return label.id === next?.id && label.name === next?.name && label.color === next?.color;
  });
}

function hasSameRenderedKanbanTask(left: KanbanTask, right: KanbanTask | undefined) {
  if (!right) return false;

  return (
    left.id === right.id &&
    left.taskKey === right.taskKey &&
    left.title === right.title &&
    left.status === right.status &&
    left.taskPriority === right.taskPriority &&
    left.dueAt === right.dueAt &&
    left.engine === right.engine &&
    left.updatedAt === right.updatedAt &&
    hasSameKanbanLabels(left, right) &&
    hasSameKanbanChecklist(left, right)
  );
}

export function hasKanbanServerSnapshotChanged(previous: KanbanColumns, next: KanbanColumns) {
  return allStatuses.some((status) => {
    if (previous[status].length !== next[status].length) {
      return true;
    }

    return previous[status].some(
      (task, index) => !hasSameRenderedKanbanTask(task, next[status][index]),
    );
  });
}

export function collectRecoveryTaskKeys(previous: KanbanColumns, next: KanbanColumns) {
  const taskKeys = new Set(buildUpdates(previous, next).map((update) => update.taskKey));
  const nextIds = new Set(allStatuses.flatMap((status) => next[status].map((task) => task.id)));

  for (const status of allStatuses) {
    for (const task of previous[status]) {
      if (!nextIds.has(task.id)) {
        taskKeys.add(task.taskKey);
      }
    }
  }

  return [...taskKeys];
}

export function shouldRefreshKanbanAfterPersist(params: {
  didFail: boolean;
  didRepairFail?: boolean;
}) {
  return params.didFail && params.didRepairFail === true;
}
