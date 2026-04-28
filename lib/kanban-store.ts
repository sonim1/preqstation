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

export type FocusedTaskDetailStatus = 'idle' | 'loading' | 'ready';

export type EditableBoardTask = {
  id: string;
  taskKey: string;
  title: string;
  branch: string | null;
  note: string | null;
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

export type KanbanStoreState = {
  tasksByKey: Record<string, KanbanTask>;
  taskKeysById: Record<string, string>;
  columnTaskKeys: Record<KanbanStatus, string[]>;
  focusedTaskKey: string | null;
  focusedTask: EditableBoardTask | null;
  focusedTaskDetailStatus: FocusedTaskDetailStatus;
  isReconciliationPaused: boolean;
  hydrate: (snapshot: KanbanHydrationSnapshot) => void;
  applyMove: (taskId: string, status: KanbanStatus, index: number) => string[];
  upsertSnapshots: (tasks: KanbanTask[]) => void;
  setFocusedTask: (task: EditableBoardTask | null) => void;
  openFocusedTaskFromBoardTask: (task: KanbanTask) => void;
  setReconciliationPaused: (paused: boolean) => void;
  removeTask: (taskKey: string) => void;
  applyOptimisticRunState: (taskKey: string, queuedAt: string) => void;
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
    .sort((left, right) => left.sortOrder.localeCompare(right.sortOrder))
    .map((task) => task.taskKey);
}

export function buildEditableBoardTaskPreview(task: KanbanTask): EditableBoardTask {
  return {
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    branch: task.branch ?? null,
    note: task.note,
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

export function createKanbanStore(snapshot: KanbanHydrationSnapshot) {
  return createStore<KanbanStoreState>()((set, get) => {
    const normalized = normalizeColumns(snapshot.columns);

    return {
      ...normalized,
      ...focusState(snapshot.focusedTask),
      isReconciliationPaused: false,
      hydrate(nextSnapshot) {
        const nextNormalized = normalizeColumns(nextSnapshot.columns);
        set({
          ...nextNormalized,
          ...focusState(nextSnapshot.focusedTask),
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
      applyOptimisticRunState(taskKey, queuedAt) {
        const previous = selectKanbanColumns(get());
        const next = queueTaskExecutionOptimistically(previous, taskKey, queuedAt);
        if (!next.changed) return;

        const nextNormalized = normalizeColumns(next.next);
        const current = get();
        const focusedTask =
          current.focusedTaskKey === taskKey && current.focusedTask
            ? {
                ...current.focusedTask,
                runState: 'queued' as const,
                runStateUpdatedAt: queuedAt,
              }
            : current.focusedTask;

        set({
          ...nextNormalized,
          ...focusState(focusedTask, current.focusedTaskDetailStatus),
        });
      },
    };
  });
}
