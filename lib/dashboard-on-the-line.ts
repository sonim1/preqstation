type OnTheLineTask = {
  id: string;
  taskKey: string;
  status: string;
  runState?: string | null;
  runStateUpdatedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type OnTheLineLaneRole = 'now' | 'next';

type OnTheLineRow<T extends OnTheLineTask> = T & {
  laneRole: OnTheLineLaneRole;
};

const ELIGIBLE_STATUSES = new Set(['inbox', 'todo', 'hold', 'ready']);
const VISIBLE_ROW_LIMIT = 4;

function isEligibleOnTheLineStatus(status: string) {
  return ELIGIBLE_STATUSES.has(status);
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = value instanceof Date ? value : new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getPrimaryActivityAt(task: OnTheLineTask) {
  return toTimestamp(task.runStateUpdatedAt) > Number.NEGATIVE_INFINITY
    ? toTimestamp(task.runStateUpdatedAt)
    : toTimestamp(task.updatedAt);
}

function compareByTaskKey(left: OnTheLineTask, right: OnTheLineTask) {
  return left.taskKey.localeCompare(right.taskKey);
}

function compareRunningTasks(left: OnTheLineTask, right: OnTheLineTask) {
  const runStateDiff = toTimestamp(right.runStateUpdatedAt) - toTimestamp(left.runStateUpdatedAt);
  if (runStateDiff !== 0) return runStateDiff;

  const updatedDiff = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return compareByTaskKey(left, right);
}

function compareNextTasks(left: OnTheLineTask, right: OnTheLineTask) {
  const primaryDiff = getPrimaryActivityAt(right) - getPrimaryActivityAt(left);
  if (primaryDiff !== 0) return primaryDiff;

  const updatedDiff = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return compareByTaskKey(left, right);
}

export function selectOnTheLineTodos<T extends OnTheLineTask>(tasks: T[]) {
  const eligibleTasks = tasks.filter((task) => isEligibleOnTheLineStatus(task.status));
  const runningTasks = eligibleTasks
    .filter((task) => task.runState === 'running')
    .sort(compareRunningTasks);
  const nowTask = runningTasks[0] ?? null;
  const nextTasks = eligibleTasks.filter((task) => task.id !== nowTask?.id).sort(compareNextTasks);

  const rows = (nowTask ? [nowTask, ...nextTasks] : nextTasks)
    .slice(0, VISIBLE_ROW_LIMIT)
    .map((task, index) => ({
      ...task,
      laneRole:
        nowTask && index === 0 && task.id === nowTask.id ? ('now' as const) : ('next' as const),
    })) satisfies Array<OnTheLineRow<T>>;

  const nowCount = rows.filter((task) => task.laneRole === 'now').length;

  return {
    rows,
    nowCount,
    nextCount: rows.length - nowCount,
  };
}
