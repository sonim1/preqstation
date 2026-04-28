export const TASK_PRIORITIES = ['highest', 'high', 'medium', 'none', 'low', 'lowest'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_STATUSES = ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const BOARD_TASK_STATUSES = ['inbox', 'todo', 'hold', 'ready', 'done'] as const;
export type BoardTaskStatus = (typeof BOARD_TASK_STATUSES)[number];
export const BOARD_FLOW_TASK_STATUSES = BOARD_TASK_STATUSES;
export type BoardFlowTaskStatus = BoardTaskStatus;
export const TASK_RUN_STATES = ['queued', 'running'] as const;
export type TaskRunState = (typeof TASK_RUN_STATES)[number];
export const TASK_RUN_STATE_LABELS: Record<TaskRunState, string> = {
  queued: 'Queued',
  running: 'Working',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  todo: 'Todo',
  hold: 'Hold',
  ready: 'Ready',
  done: 'Done',
  archived: 'Archived',
};

export const BOARD_STATUS_LABELS: Record<BoardTaskStatus, string> = {
  inbox: 'Inbox',
  todo: 'Planned',
  hold: 'Hold',
  ready: 'Ready',
  done: 'Done',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  inbox: 'cyan',
  todo: 'blue',
  hold: 'yellow',
  ready: 'orange',
  done: 'green',
  archived: 'gray',
};

export const TASK_PRIORITY_SYMBOL: Record<TaskPriority, string> = {
  highest: '↑↑',
  high: '↑',
  medium: '–',
  none: '',
  low: '↓',
  lowest: '↓↓',
};

export const TASK_PRIORITY_COLOR: Record<TaskPriority, string | null> = {
  highest: '#fa5252',
  high: '#fd7e14',
  medium: '#fab005',
  none: null,
  low: '#40c057',
  lowest: '#868e96',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  none: 'No priority',
  low: 'Low',
  lowest: 'Lowest',
};

export const TASK_LABEL_COLORS = [
  'gray',
  'blue',
  'green',
  'orange',
  'yellow',
  'red',
  'violet',
  'indigo',
  'teal',
  'pink',
] as const;
export type TaskLabelColor = (typeof TASK_LABEL_COLORS)[number];
export type TaskLabelColorValue = TaskLabelColor | `#${string}`;

export const TASK_LABEL_COLOR_SWATCHES: Record<TaskLabelColor, string> = {
  gray: '#868e96',
  blue: '#228be6',
  green: '#40c057',
  orange: '#fd7e14',
  yellow: '#fab005',
  red: '#fa5252',
  violet: '#7950f2',
  indigo: '#4c6ef5',
  teal: '#12b886',
  pink: '#e64980',
};

const TASK_LABEL_HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function parseTaskPriority(value: string | null | undefined): TaskPriority {
  const normalized = (value || '').trim();
  if (TASK_PRIORITIES.includes(normalized as TaskPriority)) {
    return normalized as TaskPriority;
  }
  return 'none';
}

export function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  const normalized = (value || '').trim();
  return TASK_STATUSES.includes(normalized as TaskStatus);
}

export function isTaskRunState(value: string | null | undefined): value is TaskRunState {
  const normalized = (value || '').trim();
  return TASK_RUN_STATES.includes(normalized as TaskRunState);
}

export function coerceTaskRunState(value: string | null | undefined): TaskRunState | null {
  return isTaskRunState(value) ? value : null;
}

export function taskRunStateLabel(value: string | null | undefined) {
  const normalized = coerceTaskRunState(value);
  return normalized ? TASK_RUN_STATE_LABELS[normalized] : 'None';
}

export function normalizeTaskLabelColor(
  value: string | null | undefined,
): TaskLabelColorValue | null {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (TASK_LABEL_COLORS.includes(normalized as TaskLabelColor)) {
    return normalized as TaskLabelColor;
  }
  if (TASK_LABEL_HEX_COLOR_PATTERN.test(normalized)) {
    return normalized as `#${string}`;
  }
  return null;
}

export function parseTaskLabelColor(value: string | null | undefined): TaskLabelColorValue {
  return normalizeTaskLabelColor(value) ?? 'blue';
}

export function resolveTaskLabelSwatchColor(value: string | null | undefined) {
  const normalized = normalizeTaskLabelColor(value);
  if (!normalized) return TASK_LABEL_COLOR_SWATCHES.blue;
  if (normalized.startsWith('#')) return normalized;
  return TASK_LABEL_COLOR_SWATCHES[normalized as TaskLabelColor];
}

export function withTaskPrioritySymbol(title: string, taskPriority: string, taskKey?: string) {
  const symbol = TASK_PRIORITY_SYMBOL[parseTaskPriority(taskPriority)];
  const labeledTitle = symbol ? `${symbol} ${title}` : title;
  return taskKey ? `${taskKey} · ${labeledTitle}` : labeledTitle;
}

export function taskPriorityOptionData() {
  return TASK_PRIORITIES.map((priority) => {
    const symbol = TASK_PRIORITY_SYMBOL[priority];
    const label = TASK_PRIORITY_LABEL[priority];
    return {
      value: priority,
      label: symbol ? `${symbol} ${label}` : label,
    };
  });
}
