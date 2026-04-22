import type { BoardTaskStatus, TaskStatus } from '@/lib/task-meta';

type TaskTerminology = {
  singular: string;
  singularLower: string;
  plural: string;
  pluralLower: string;
};

type AgentTerminology = {
  plural: string;
  pluralLower: string;
};

export type Terminology = {
  task: TaskTerminology;
  agents: AgentTerminology;
  statuses: Record<TaskStatus, string>;
  boardStatuses: Record<BoardTaskStatus, string>;
};

export const DEFAULT_TERMINOLOGY: Terminology = {
  task: {
    singular: 'Task',
    singularLower: 'task',
    plural: 'Tasks',
    pluralLower: 'tasks',
  },
  agents: {
    plural: 'AI agents',
    pluralLower: 'AI agents',
  },
  statuses: {
    inbox: 'Inbox',
    todo: 'Todo',
    hold: 'Hold',
    ready: 'Ready',
    done: 'Done',
    archived: 'Archived',
  },
  boardStatuses: {
    inbox: 'Inbox',
    todo: 'Planned',
    hold: 'Hold',
    ready: 'Ready',
    done: 'Done',
  },
};

export const KITCHEN_TERMINOLOGY: Terminology = {
  task: {
    singular: 'Ticket',
    singularLower: 'ticket',
    plural: 'Tickets',
    pluralLower: 'tickets',
  },
  agents: {
    plural: 'Line Cooks',
    pluralLower: 'line cooks',
  },
  statuses: {
    inbox: 'Inbox',
    todo: 'Todo',
    hold: "86'd",
    ready: 'Pass',
    done: 'Order Up',
    archived: 'Archived',
  },
  boardStatuses: {
    inbox: 'Inbox',
    todo: 'Planned',
    hold: "86'd",
    ready: 'Pass',
    done: 'Order Up',
  },
};

export function resolveTerminology(enabled: boolean) {
  return enabled ? KITCHEN_TERMINOLOGY : DEFAULT_TERMINOLOGY;
}

function normalizeStatus(value: string | null | undefined) {
  return (value || '').trim();
}

export function getTaskStatusLabel(
  status: string | null | undefined,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'Unknown';
  if (normalized in terminology.statuses) {
    return terminology.statuses[normalized as TaskStatus];
  }
  return normalized;
}

export function getBoardStatusLabel(
  status: string | null | undefined,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  const normalized = normalizeStatus(status);
  if (!normalized) return 'Unknown';
  if (normalized in terminology.boardStatuses) {
    return terminology.boardStatuses[normalized as BoardTaskStatus];
  }
  return getTaskStatusLabel(normalized, terminology);
}

function buildStatusLabelAliases() {
  const aliases: Record<string, TaskStatus> = {};

  for (const terminology of [DEFAULT_TERMINOLOGY, KITCHEN_TERMINOLOGY]) {
    for (const [status, label] of Object.entries(terminology.statuses)) {
      aliases[label.toLowerCase()] = status as TaskStatus;
    }
    for (const [status, label] of Object.entries(terminology.boardStatuses)) {
      aliases[label.toLowerCase()] = status as TaskStatus;
    }
  }

  return aliases;
}

const STATUS_LABEL_ALIASES = buildStatusLabelAliases();

export function parseTaskStatusLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return '';
  return (
    STATUS_LABEL_ALIASES[normalized.toLowerCase()] ?? normalized.toLowerCase().replace(/\s+/g, '_')
  );
}
