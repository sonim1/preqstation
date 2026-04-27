import { generateKeyBetween, rebalanceKeys } from '@/lib/fractional-ordering';
import { normalizeTaskDispatchTarget, type TaskDispatchTarget } from '@/lib/task-dispatch';
import { extractTaskLabels } from '@/lib/task-label-utils';
import {
  BOARD_FLOW_TASK_STATUSES,
  BOARD_TASK_STATUSES,
  type BoardTaskStatus,
  coerceTaskRunState,
  TASK_STATUS_COLORS,
  TASK_STATUSES,
  type TaskRunState,
  type TaskStatus,
} from '@/lib/task-meta';
import {
  DEFAULT_TERMINOLOGY,
  getBoardStatusLabel,
  getTaskStatusLabel,
  type Terminology,
} from '@/lib/terminology';

export type KanbanStatus = TaskStatus;

export type KanbanTask = {
  id: string;
  taskKey: string;
  branch?: string | null;
  title: string;
  note: string | null;
  status: KanbanStatus;
  sortOrder: string;
  taskPriority: string;
  dueAt: string | null;
  engine: string | null;
  dispatchTarget?: TaskDispatchTarget | null;
  runState: TaskRunState | null;
  runStateUpdatedAt: string | null;
  project: { id: string; name: string; projectKey: string } | null;
  updatedAt: string;
  archivedAt: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
};

export type EnginePresets = {
  defaultEngine: string;
  columnEngines: Partial<Record<KanbanStatus, string>>;
};

export type KanbanColumns = Record<KanbanStatus, KanbanTask[]>;

export const allStatuses = [...TASK_STATUSES] as KanbanStatus[];
export const boardStatuses = [...BOARD_TASK_STATUSES] as const;
export const statusLabels: Record<KanbanStatus, string> = DEFAULT_TERMINOLOGY.statuses;
export const statusColors: Record<KanbanStatus, string> = TASK_STATUS_COLORS;

export function taskStatusLabel(
  status: KanbanStatus,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  return getTaskStatusLabel(status, terminology);
}

export function boardStatusLabel(
  status: KanbanStatus,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  return getBoardStatusLabel(status, terminology);
}

export function getBoardFlowStatuses() {
  return [...BOARD_FLOW_TASK_STATUSES] as const;
}

export function shouldShowHoldLane(columns: Pick<KanbanColumns, 'hold'>) {
  return columns.hold.length > 0;
}

export function getMobileBoardStatuses(columns: Pick<KanbanColumns, 'hold'>, activeTab: string) {
  const statuses: BoardTaskStatus[] = [...getBoardFlowStatuses()];
  if (shouldShowHoldLane(columns) || activeTab === 'hold') {
    statuses.push('hold');
  }
  return statuses;
}

export function findTaskLocation(columns: KanbanColumns, taskId: string) {
  for (const status of allStatuses) {
    const index = columns[status].findIndex((task) => task.id === taskId);
    if (index >= 0) return { status, index };
  }

  return null;
}

export function moveTask(
  columns: KanbanColumns,
  taskId: string,
  targetStatus: KanbanStatus,
  targetIndex: number,
) {
  const source = findTaskLocation(columns, taskId);
  if (!source) return { changed: false, next: columns };

  const sameColumn = source.status === targetStatus;
  const sourceItems = [...columns[source.status]];
  const [task] = sourceItems.splice(source.index, 1);
  if (!task) return { changed: false, next: columns };

  const targetItems = sameColumn ? sourceItems : [...columns[targetStatus]];
  const insertIndex = Math.max(0, Math.min(targetIndex, targetItems.length));

  const sortOrder = computeSortOrder(targetItems, insertIndex);
  targetItems.splice(insertIndex, 0, { ...task, status: targetStatus, sortOrder });
  const nextTargetItems = normalizeColumnSortOrders(targetItems);
  const nextSourceItems = sameColumn ? nextTargetItems : normalizeColumnSortOrders(sourceItems);

  const next: KanbanColumns = {
    ...columns,
    [source.status]: sameColumn ? nextTargetItems : nextSourceItems,
    [targetStatus]: nextTargetItems,
  };

  return { changed: true, next };
}

function applyQueuedTaskState(task: KanbanTask, queuedAt: string) {
  return {
    ...task,
    runState: 'queued' as const,
    runStateUpdatedAt: queuedAt,
    archivedAt: null,
  };
}

export function queueTaskExecutionOptimistically(
  columns: KanbanColumns,
  taskKey: string,
  queuedAt: string,
) {
  const source = allStatuses.find((status) =>
    columns[status].some((task) => task.taskKey === taskKey),
  );
  if (!source) return { changed: false, next: columns };

  const sourceIndex = columns[source].findIndex((task) => task.taskKey === taskKey);
  const sourceTask = sourceIndex >= 0 ? columns[source][sourceIndex] : null;
  if (!sourceTask) return { changed: false, next: columns };

  const nextTask = applyQueuedTaskState(sourceTask, queuedAt);
  const changed =
    sourceTask.status !== nextTask.status ||
    sourceTask.runState !== nextTask.runState ||
    sourceTask.runStateUpdatedAt !== nextTask.runStateUpdatedAt ||
    sourceTask.archivedAt !== nextTask.archivedAt;
  if (!changed) return { changed: false, next: columns };

  return {
    changed: true,
    next: {
      ...columns,
      [source]: columns[source].map((task, index) => (index === sourceIndex ? nextTask : task)),
    },
  };
}

export function computeSortOrder(column: KanbanTask[], insertIndex: number): string {
  const prev = insertIndex > 0 ? column[insertIndex - 1].sortOrder : null;
  const next = insertIndex < column.length ? column[insertIndex].sortOrder : null;
  if (prev && next && prev >= next) {
    const nextGreater = findNextGreaterSortOrder(column, insertIndex, prev);
    if (nextGreater) {
      return generateKeyBetween(prev, nextGreater);
    }

    const previousLower = findPreviousLowerSortOrder(column, insertIndex - 1, next);
    if (previousLower) {
      return generateKeyBetween(previousLower, next);
    }

    if (insertIndex === 0) {
      return generateKeyBetween(null, next);
    }

    return generateKeyBetween(prev, null);
  }

  return generateKeyBetween(prev, next);
}

function findNextGreaterSortOrder(
  column: KanbanTask[],
  startIndex: number,
  lowerBound: string,
): string | null {
  for (let index = startIndex; index < column.length; index += 1) {
    const candidate = column[index]?.sortOrder ?? null;
    if (candidate && candidate > lowerBound) {
      return candidate;
    }
  }

  return null;
}

function findPreviousLowerSortOrder(
  column: KanbanTask[],
  startIndex: number,
  upperBound: string,
): string | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    const candidate = column[index]?.sortOrder ?? null;
    if (candidate && candidate < upperBound) {
      return candidate;
    }
  }

  return null;
}

function hasStrictSortOrders(column: KanbanTask[]) {
  for (let index = 1; index < column.length; index += 1) {
    if (column[index - 1].sortOrder >= column[index].sortOrder) {
      return false;
    }
  }

  return true;
}

function normalizeColumnSortOrders(column: KanbanTask[]) {
  if (column.length < 2 || hasStrictSortOrders(column)) {
    return column;
  }

  const nextKeys = rebalanceKeys(column.length);
  return column.map((task, index) => ({ ...task, sortOrder: nextKeys[index] }));
}

export function buildUpdates(previous: KanbanColumns, next: KanbanColumns) {
  const previousMap = new Map<string, { status: KanbanStatus; sortOrder: string }>();
  for (const status of allStatuses) {
    for (const task of previous[status]) {
      previousMap.set(task.id, { status, sortOrder: task.sortOrder });
    }
  }

  const updates: Array<{ id: string; taskKey: string; status: KanbanStatus; sortOrder: string }> =
    [];
  for (const status of allStatuses) {
    for (const task of next[status]) {
      const previousTask = previousMap.get(task.id);
      if (
        !previousTask ||
        previousTask.status !== status ||
        previousTask.sortOrder !== task.sortOrder
      ) {
        updates.push({ id: task.id, taskKey: task.taskKey, status, sortOrder: task.sortOrder });
      }
    }
  }

  return updates;
}

export type TaskForKanban = {
  id: string;
  taskKey: string;
  branch?: string | null;
  title: string;
  note: string | null;
  sortOrder: string;
  taskPriority: string;
  dueAt: Date | null;
  engine: string | null;
  dispatchTarget: string | null;
  runState: string | null;
  runStateUpdatedAt: Date | null;
  archivedAt: Date | null;
  updatedAt: Date;
  project: { id: string; name: string; projectKey: string } | null;
  labels?: Array<{ id: string; name: string; color: string }>;
  label?: { id: string; name: string; color: string } | null;
  labelAssignments?: Array<{
    position?: number;
    label?: { id: string; name: string; color: string } | null;
  }>;
};

export function toKanbanTask(task: TaskForKanban, status: KanbanStatus): KanbanTask {
  const labels = extractTaskLabels(task);

  return {
    id: task.id,
    taskKey: task.taskKey,
    branch: task.branch ?? null,
    title: task.title,
    note: task.note,
    status,
    sortOrder: task.sortOrder,
    taskPriority: task.taskPriority,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    engine: task.engine ?? null,
    dispatchTarget: normalizeTaskDispatchTarget(task.dispatchTarget),
    runState: coerceTaskRunState(task.runState),
    runStateUpdatedAt: task.runStateUpdatedAt ? task.runStateUpdatedAt.toISOString() : null,
    archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
    updatedAt: task.updatedAt.toISOString(),
    project: task.project
      ? { id: task.project.id, name: task.project.name, projectKey: task.project.projectKey }
      : null,
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color || 'blue',
    })),
  };
}

export function resolveDisplayEngine(
  taskEngine: string | null,
  _status: KanbanStatus,
  _presets: EnginePresets | null,
): string | null {
  return taskEngine || null;
}

export function groupTasksByStatus(tasks: (TaskForKanban & { status: string })[]) {
  const statuses = TASK_STATUSES;
  return Object.fromEntries(
    statuses.map((s) => [s, tasks.filter((t) => t.status === s).map((t) => toKanbanTask(t, s))]),
  ) as Record<KanbanStatus, KanbanTask[]>;
}
