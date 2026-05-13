import { createStore } from 'zustand/vanilla';

import {
  allStatuses,
  buildUpdates,
  type KanbanColumns,
  type KanbanStatus,
  type KanbanTask,
  moveTask,
  queueTaskExecutionOptimistically,
} from '@/lib/kanban-helpers';
import type { TaskArtifact } from '@/lib/task-artifacts';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';

export type FocusedTaskDetailStatus = 'idle' | 'loading' | 'ready';

export type EditableBoardTask = {
  id: string;
  taskKey: string;
  title: string;
  branch: string | null;
  note: string | null;
  artifacts?: TaskArtifact[];
  projectId: string | null;
  labelIds: string[];
  labels: Array<{ id: string; name: string; color: string | null }>;
  taskPriority: string;
  status: string;
  engine: string | null;
  dispatchTarget: KanbanTask['dispatchTarget'] | null;
  runState: 'queued' | 'running' | null;
  runStateUpdatedAt: string | null;
  workLogs: Array<{
    id: string;
    title: string;
    detail?: string | null;
    engine?: string | null;
    workedAt: Date;
    createdAt: Date;
    todo?: { engine: string | null } | null;
  }>;
};

export type KanbanHydrationSnapshot = {
  columns: KanbanColumns;
  focusedTask: EditableBoardTask | null;
};

type NormalizedKanbanBoard = {
  tasksByKey: Record<string, KanbanTask>;
  taskKeysById: Record<string, string>;
  columnTaskKeys: Record<KanbanStatus, string[]>;
};

const kanbanColumnsCache = new WeakMap<
  Record<string, KanbanTask>,
  WeakMap<Record<KanbanStatus, string[]>, KanbanColumns>
>();
const runStatePollingStatusCache = new WeakMap<
  Record<string, KanbanTask>,
  {
    lastTaskQueuedAt: string | null;
    result: KanbanRunStatePollingStatus;
  }
>();

type KanbanRunStatePollingStatus = {
  hasQueued: boolean;
  hasRunning: boolean;
  lastTaskQueuedAt: string | null;
};

let lastRunStatePollingStatusResult: KanbanRunStatePollingStatus | null = null;

export type KanbanStoreState = {
  tasksByKey: Record<string, KanbanTask>;
  taskKeysById: Record<string, string>;
  columnTaskKeys: Record<KanbanStatus, string[]>;
  focusedTaskKey: string | null;
  focusedTask: EditableBoardTask | null;
  focusedTaskDetailStatus: FocusedTaskDetailStatus;
  isReconciliationPaused: boolean;
  lastTaskQueuedAt: string | null;
  hydrate: (snapshot: KanbanHydrationSnapshot) => void;
  applyMove: (taskId: string, status: KanbanStatus, index: number) => string[];
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
  openFocusedTaskFromBoardTask: (task: KanbanTask) => void;
  setReconciliationPaused: (paused: boolean) => void;
  removeTask: (taskKey: string) => void;
  setTaskUnreadNotification: (taskKey: string, hasUnreadNotification: boolean) => void;
  applyOptimisticRunState: (
    taskKey: string,
    queuedAt: string,
    dispatchTarget?: KanbanTask['dispatchTarget'] | null,
  ) => void;
};

function emptyColumnTaskKeys(): Record<KanbanStatus, string[]> {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function emptyKanbanColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function normalizeColumns(columns: KanbanColumns): NormalizedKanbanBoard {
  const tasksByKey: Record<string, KanbanTask> = {};
  const taskKeysById: Record<string, string> = {};
  const columnTaskKeys = emptyColumnTaskKeys();

  for (const status of allStatuses) {
    for (const task of columns[status] ?? []) {
      tasksByKey[task.taskKey] = { ...task, status };
      taskKeysById[task.id] = task.taskKey;
      columnTaskKeys[status].push(task.taskKey);
    }
  }

  return { tasksByKey, taskKeysById, columnTaskKeys };
}

function isServerRunStateStale(
  incomingRunState: KanbanTask['runState'],
  incomingUpdatedAt: string | null,
  currentUpdatedAt: string | null,
) {
  if (!incomingUpdatedAt || !currentUpdatedAt) return !incomingRunState;

  return Date.parse(incomingUpdatedAt) < Date.parse(currentUpdatedAt);
}

function mergeOptimisticQueuedRunState<
  T extends Pick<KanbanTask, 'runState' | 'runStateUpdatedAt'>,
>(incoming: T, current: Pick<KanbanTask, 'runState' | 'runStateUpdatedAt'> | null | undefined): T {
  if (
    current?.runState !== 'queued' ||
    !isServerRunStateStale(incoming.runState, incoming.runStateUpdatedAt, current.runStateUpdatedAt)
  ) {
    return incoming;
  }

  return {
    ...incoming,
    runState: current.runState,
    runStateUpdatedAt: current.runStateUpdatedAt,
  };
}

function mergeHydratedColumns(
  incoming: KanbanColumns,
  currentTasksByKey: Record<string, KanbanTask>,
): KanbanColumns {
  return allStatuses.reduce((columns, status) => {
    columns[status] = (incoming[status] ?? []).map((task) =>
      mergeOptimisticQueuedRunState(task, currentTasksByKey[task.taskKey]),
    );
    return columns;
  }, emptyKanbanColumns());
}

export function denormalizeColumns(
  tasksByKey: Record<string, KanbanTask>,
  columnTaskKeys: Record<KanbanStatus, string[]>,
): KanbanColumns {
  const columns = emptyKanbanColumns();

  for (const status of allStatuses) {
    columns[status] = columnTaskKeys[status]
      .map((taskKey) => tasksByKey[taskKey])
      .filter((task): task is KanbanTask => Boolean(task))
      .map((task) => (task.status === status ? task : { ...task, status }));
  }

  return columns;
}

function sortTaskKeysForStatus(
  tasksByKey: Record<string, KanbanTask>,
  taskKeys: string[],
  status: KanbanStatus,
) {
  return [...taskKeys]
    .map((taskKey) => tasksByKey[taskKey])
    .filter((task): task is KanbanTask => Boolean(task) && task.status === status)
    .sort((left, right) =>
      left.sortOrder < right.sortOrder ? -1 : left.sortOrder > right.sortOrder ? 1 : 0,
    )
    .map((task) => task.taskKey);
}

export function buildEditableBoardTaskPreview(task: KanbanTask): EditableBoardTask {
  return {
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    branch: task.branch ?? null,
    note: task.note,
    artifacts: task.artifacts,
    projectId: task.project?.id ?? null,
    labelIds: task.labels.map((label) => label.id),
    labels: task.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
    })),
    taskPriority: task.taskPriority,
    status: task.status,
    engine: task.engine,
    dispatchTarget: task.dispatchTarget ?? null,
    runState: task.runState,
    runStateUpdatedAt: task.runStateUpdatedAt,
    workLogs: [],
  };
}

function focusState(
  task: EditableBoardTask | null,
  detailStatus: FocusedTaskDetailStatus = task ? 'ready' : 'idle',
) {
  return {
    focusedTask: task,
    focusedTaskKey: task?.taskKey ?? null,
    focusedTaskDetailStatus: detailStatus,
  };
}

export function selectKanbanColumns(
  state: Pick<KanbanStoreState, 'tasksByKey' | 'columnTaskKeys'>,
) {
  let cacheByColumns = kanbanColumnsCache.get(state.tasksByKey);
  if (!cacheByColumns) {
    cacheByColumns = new WeakMap<Record<KanbanStatus, string[]>, KanbanColumns>();
    kanbanColumnsCache.set(state.tasksByKey, cacheByColumns);
  }

  const cachedColumns = cacheByColumns.get(state.columnTaskKeys);
  if (cachedColumns) {
    return cachedColumns;
  }

  const columns = denormalizeColumns(state.tasksByKey, state.columnTaskKeys);
  cacheByColumns.set(state.columnTaskKeys, columns);
  return columns;
}

export function selectKanbanRunStatePollingStatus(
  state: Pick<KanbanStoreState, 'tasksByKey' | 'lastTaskQueuedAt'>,
) {
  const cached = runStatePollingStatusCache.get(state.tasksByKey);
  if (cached?.lastTaskQueuedAt === state.lastTaskQueuedAt) {
    return cached.result;
  }

  let hasQueued = false;
  let hasRunning = false;

  for (const task of Object.values(state.tasksByKey)) {
    if (task.runState === 'queued') {
      hasQueued = true;
    } else if (task.runState === 'running') {
      hasRunning = true;
    }

    if (hasQueued && hasRunning) break;
  }

  const result = {
    hasQueued,
    hasRunning,
    lastTaskQueuedAt: state.lastTaskQueuedAt,
  };
  const stableResult =
    lastRunStatePollingStatusResult &&
    lastRunStatePollingStatusResult.hasQueued === result.hasQueued &&
    lastRunStatePollingStatusResult.hasRunning === result.hasRunning &&
    lastRunStatePollingStatusResult.lastTaskQueuedAt === result.lastTaskQueuedAt
      ? lastRunStatePollingStatusResult
      : result;
  lastRunStatePollingStatusResult = stableResult;
  runStatePollingStatusCache.set(state.tasksByKey, {
    lastTaskQueuedAt: state.lastTaskQueuedAt,
    result: stableResult,
  });

  return stableResult;
}

export function createKanbanStore(snapshot: KanbanHydrationSnapshot) {
  return createStore<KanbanStoreState>()((set, get) => {
    const normalized = normalizeColumns(snapshot.columns);

    return {
      ...normalized,
      ...focusState(snapshot.focusedTask),
      isReconciliationPaused: false,
      lastTaskQueuedAt: null,
      hydrate(nextSnapshot) {
        const current = get();
        const nextColumns = mergeHydratedColumns(nextSnapshot.columns, current.tasksByKey);
        const nextFocusedTask =
          nextSnapshot.focusedTask &&
          current.focusedTask &&
          nextSnapshot.focusedTask.taskKey === current.focusedTask.taskKey
            ? mergeOptimisticQueuedRunState(nextSnapshot.focusedTask, current.focusedTask)
            : nextSnapshot.focusedTask;
        const nextNormalized = normalizeColumns(nextColumns);
        set({
          ...nextNormalized,
          ...focusState(nextFocusedTask),
        });
      },
      applyMove(taskId, status, index) {
        const previous = selectKanbanColumns(get());
        const moved = moveTask(previous, taskId, status, index);
        if (!moved.changed) {
          return [];
        }

        const nextNormalized = normalizeColumns(moved.next);
        set(nextNormalized);
        return buildUpdates(previous, moved.next).map((update) => update.taskKey);
      },
      upsertSnapshots(tasks) {
        if (tasks.length === 0) return;

        const current = get();
        const nextTasksByKey = { ...current.tasksByKey };
        const nextTaskKeysById = { ...current.taskKeysById };
        const nextColumnTaskKeys = {
          inbox: [...current.columnTaskKeys.inbox],
          todo: [...current.columnTaskKeys.todo],
          hold: [...current.columnTaskKeys.hold],
          ready: [...current.columnTaskKeys.ready],
          done: [...current.columnTaskKeys.done],
          archived: [...current.columnTaskKeys.archived],
        };

        for (const task of tasks) {
          const previousTask = nextTasksByKey[task.taskKey];
          if (previousTask) {
            delete nextTaskKeysById[previousTask.id];
          }

          for (const statusKey of allStatuses) {
            nextColumnTaskKeys[statusKey] = nextColumnTaskKeys[statusKey].filter(
              (taskKey) => taskKey !== task.taskKey,
            );
          }

          nextTasksByKey[task.taskKey] = task;
          nextTaskKeysById[task.id] = task.taskKey;
          nextColumnTaskKeys[task.status] = sortTaskKeysForStatus(
            nextTasksByKey,
            [...nextColumnTaskKeys[task.status], task.taskKey],
            task.status,
          );
        }

        set({
          tasksByKey: nextTasksByKey,
          taskKeysById: nextTaskKeysById,
          columnTaskKeys: nextColumnTaskKeys,
        });
      },
      setFocusedTask(task) {
        set(focusState(task));
      },
      openFocusedTaskFromBoardTask(task) {
        set(focusState(buildEditableBoardTaskPreview(task), 'loading'));
      },
      setReconciliationPaused(paused) {
        set({ isReconciliationPaused: paused });
      },
      removeTask(taskKey) {
        const current = get();
        const nextTasksByKey = { ...current.tasksByKey };
        const removedTask = nextTasksByKey[taskKey];
        if (removedTask) {
          delete nextTasksByKey[taskKey];
        }

        const nextTaskKeysById = { ...current.taskKeysById };
        if (removedTask) {
          delete nextTaskKeysById[removedTask.id];
        }

        const nextColumnTaskKeys = {
          inbox: current.columnTaskKeys.inbox.filter((key) => key !== taskKey),
          todo: current.columnTaskKeys.todo.filter((key) => key !== taskKey),
          hold: current.columnTaskKeys.hold.filter((key) => key !== taskKey),
          ready: current.columnTaskKeys.ready.filter((key) => key !== taskKey),
          done: current.columnTaskKeys.done.filter((key) => key !== taskKey),
          archived: current.columnTaskKeys.archived.filter((key) => key !== taskKey),
        };

        set({
          tasksByKey: nextTasksByKey,
          taskKeysById: nextTaskKeysById,
          columnTaskKeys: nextColumnTaskKeys,
          ...(current.focusedTaskKey === taskKey ? focusState(null) : null),
        });
      },
      setTaskUnreadNotification(taskKey, hasUnreadNotification) {
        const current = get();
        const task = current.tasksByKey[taskKey];
        if (!task || Boolean(task.hasUnreadNotification) === hasUnreadNotification) {
          return;
        }

        set({
          tasksByKey: {
            ...current.tasksByKey,
            [taskKey]: {
              ...task,
              hasUnreadNotification,
            },
          },
        });
      },
      applyOptimisticRunState(taskKey, queuedAt, dispatchTarget) {
        const previous = selectKanbanColumns(get());
        const next = queueTaskExecutionOptimistically(previous, taskKey, queuedAt, dispatchTarget);
        if (!next.changed) return;

        const nextNormalized = normalizeColumns(next.next);
        const current = get();
        const nextDispatchTarget = normalizeTaskDispatchTarget(dispatchTarget);
        const focusedTask =
          current.focusedTaskKey === taskKey && current.focusedTask
            ? {
                ...current.focusedTask,
                runState: 'queued' as const,
                runStateUpdatedAt: queuedAt,
                dispatchTarget: nextDispatchTarget ?? current.focusedTask.dispatchTarget ?? null,
              }
            : current.focusedTask;

        set({
          ...nextNormalized,
          ...focusState(focusedTask, current.focusedTaskDetailStatus),
          lastTaskQueuedAt: queuedAt,
        });
      },
    };
  });
}
