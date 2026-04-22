import { parseTaskPriority, TASK_PRIORITY_LABEL } from '@/lib/task-meta';
import {
  DEFAULT_TERMINOLOGY,
  getBoardStatusLabel,
  getTaskStatusLabel,
  type Terminology,
} from '@/lib/terminology';

export type TaskFieldChange = {
  field: string;
  from: string;
  to: string;
};

export type TaskNoteChangeDetail = {
  type: 'task.note_change';
  version: 1;
  taskKey: string;
  taskTitle: string;
  previousNote: string;
  updatedNote: string;
};

function safeInline(value: string) {
  return value.replace(/`/g, "'");
}

function normalizeChangeValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : '(empty)';
  }
  return JSON.stringify(value);
}

function formatChangeLine(change: TaskFieldChange) {
  const from = safeInline(change.from);
  const to = safeInline(change.to);
  return `- ${change.field}: \`${from}\` -> \`${to}\``;
}

export function taskStatusLabel(status: string | null | undefined) {
  return getTaskStatusLabel(status);
}

function taskStatusChangeLabel(
  status: string | null | undefined,
  terminology: Terminology = DEFAULT_TERMINOLOGY,
) {
  return getBoardStatusLabel(status, terminology);
}

export function taskPriorityLabel(value: string | null | undefined) {
  const normalized = parseTaskPriority(value);
  return TASK_PRIORITY_LABEL[normalized];
}

export function addTaskFieldChange(
  changes: TaskFieldChange[],
  field: string,
  fromValue: unknown,
  toValue: unknown,
) {
  const from = normalizeChangeValue(fromValue);
  const to = normalizeChangeValue(toValue);
  if (from === to) return;
  changes.push({ field, from, to });
}

function isEmptyChangeValue(value: string) {
  return value === '(empty)' || value === '(none)';
}

function summarizeFieldChange(change: TaskFieldChange) {
  const field = change.field.toLowerCase();

  if (field === 'labels') {
    const fromEmpty = isEmptyChangeValue(change.from);
    const toEmpty = isEmptyChangeValue(change.to);
    if (fromEmpty && !toEmpty) return 'Label added';
    if (!fromEmpty && toEmpty) return 'Label removed';
    return 'Labels updated';
  }

  if (field === 'title') return 'Title changed';
  if (field === 'task priority' || field === 'priority') return 'Priority changed';
  if (field === 'note') return 'Note updated';
  if (field === 'run state') return 'Run state updated';
  if (field === 'due date') return 'Due date updated';
  if (field === 'description') return 'Description updated';
  if (field === 'acceptance criteria') return 'Acceptance criteria updated';

  return `${change.field} updated`;
}

function summarizeFieldChanges(changes: TaskFieldChange[]) {
  return changes.map(summarizeFieldChange).join(', ');
}

export function buildTaskStatusChangeWorkLog(params: {
  taskKey: string;
  taskTitle: string;
  fromStatus: string;
  toStatus: string;
  extraChanges?: TaskFieldChange[];
  terminology?: Terminology;
}) {
  const terminology = params.terminology ?? DEFAULT_TERMINOLOGY;
  const fromLabel = taskStatusChangeLabel(params.fromStatus, terminology);
  const toLabel = taskStatusChangeLabel(params.toStatus, terminology);
  const detailLines = [
    `**${terminology.task.singular}:** ${params.taskKey} · ${params.taskTitle}`,
    '',
    `- Status: \`${safeInline(fromLabel)}\` -> \`${safeInline(toLabel)}\``,
  ];

  if (params.extraChanges && params.extraChanges.length > 0) {
    detailLines.push('', '**Additional Changes**', ...params.extraChanges.map(formatChangeLine));
  }

  return {
    title: `${params.taskKey} · ${fromLabel} -> ${toLabel}`,
    detail: detailLines.join('\n'),
  };
}

export function summarizeContent(content: string | null, maxLen = 80): string {
  if (!content || !content.trim()) return '(empty)';
  const firstLine = content.trim().split(/\r?\n/)[0] || '';
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + '...';
}

export function summarizeAcceptanceCriteria(items: string[]): string {
  if (items.length === 0) return '(none)';
  const joined = items.join(' | ');
  const summary = `${items.length} items: ${joined}`;
  return summary.length <= 200 ? summary : summary.slice(0, 200) + '...';
}

export function buildTaskFieldChangeWorkLog(params: {
  taskKey: string;
  taskTitle: string;
  changes: TaskFieldChange[];
  terminology?: Terminology;
}) {
  if (params.changes.length === 0) return null;
  const terminology = params.terminology ?? DEFAULT_TERMINOLOGY;
  return {
    title: `${params.taskKey} · Fields Updated (${params.changes.length}) · ${summarizeFieldChanges(
      params.changes,
    )}`,
    detail: [
      `**${terminology.task.singular}:** ${params.taskKey} · ${params.taskTitle}`,
      '',
      ...params.changes.map(formatChangeLine),
    ].join('\n'),
  };
}

export function buildTaskNoteChangeDetail(params: {
  taskKey: string;
  taskTitle: string;
  previousNote: string | null | undefined;
  updatedNote: string | null | undefined;
}) {
  const detail: TaskNoteChangeDetail = {
    type: 'task.note_change',
    version: 1,
    taskKey: params.taskKey,
    taskTitle: params.taskTitle,
    previousNote: params.previousNote ?? '',
    updatedNote: params.updatedNote ?? '',
  };

  return JSON.stringify(detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTaskHeading(detail: string) {
  const taskLine = detail
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('**Task:**'));
  if (!taskLine) return { taskKey: '', taskTitle: '' };

  const taskText = taskLine.replace(/^\*\*Task:\*\*\s*/, '');
  const [taskKey, ...titleParts] = taskText.split(' · ');
  return {
    taskKey: taskKey ?? '',
    taskTitle: titleParts.join(' · '),
  };
}

function cleanLegacyNoteSection(section: string) {
  const trimmed = section.trim();
  if (trimmed === '_Empty_') return '';
  return trimmed;
}

function parseLegacyTaskNoteChangeDetail(detail: string): TaskNoteChangeDetail | null {
  const previousMarker = '**Previous Note**';
  const updatedMarker = '**Updated Note**';
  const previousStart = detail.indexOf(previousMarker);
  const updatedStart = detail.indexOf(updatedMarker);

  if (previousStart === -1 || updatedStart === -1 || updatedStart <= previousStart) return null;

  const previousNote = cleanLegacyNoteSection(
    detail.slice(previousStart + previousMarker.length, updatedStart),
  );
  const updatedNote = cleanLegacyNoteSection(detail.slice(updatedStart + updatedMarker.length));
  const task = parseTaskHeading(detail);

  return {
    type: 'task.note_change',
    version: 1,
    taskKey: task.taskKey,
    taskTitle: task.taskTitle,
    previousNote,
    updatedNote,
  };
}

export function parseTaskNoteChangeDetail(
  detail: string | null | undefined,
): TaskNoteChangeDetail | null {
  if (!detail) return null;

  try {
    const parsed: unknown = JSON.parse(detail);
    if (
      isRecord(parsed) &&
      parsed.type === 'task.note_change' &&
      parsed.version === 1 &&
      typeof parsed.taskKey === 'string' &&
      typeof parsed.taskTitle === 'string' &&
      typeof parsed.previousNote === 'string' &&
      typeof parsed.updatedNote === 'string'
    ) {
      return {
        type: 'task.note_change',
        version: 1,
        taskKey: parsed.taskKey,
        taskTitle: parsed.taskTitle,
        previousNote: parsed.previousNote,
        updatedNote: parsed.updatedNote,
      };
    }
  } catch {
    // Fall back to legacy markdown detail below.
  }

  return parseLegacyTaskNoteChangeDetail(detail);
}

const CHANGE_LINE_RE = /^- (.+?): `(.*)` -> `(.*)`$/;

export function parseFieldChangesFromDetail(detail: string): TaskFieldChange[] | null {
  try {
    const changes: TaskFieldChange[] = [];
    for (const line of detail.split('\n')) {
      const m = line.match(CHANGE_LINE_RE);
      if (m) {
        changes.push({ field: m[1], from: m[2], to: m[3] });
      }
    }
    return changes.length > 0 ? changes : null;
  } catch {
    return null;
  }
}

export function mergeFieldChanges(
  existing: TaskFieldChange[],
  incoming: TaskFieldChange[],
): TaskFieldChange[] {
  const map = new Map<string, TaskFieldChange>();
  for (const c of existing) {
    map.set(c.field, { ...c });
  }
  for (const c of incoming) {
    const prev = map.get(c.field);
    if (prev) {
      prev.to = c.to;
    } else {
      map.set(c.field, { ...c });
    }
  }
  // Remove no-op changes (from === to means reverted)
  const result: TaskFieldChange[] = [];
  for (const c of map.values()) {
    if (c.from !== c.to) {
      result.push(c);
    }
  }
  return result;
}

export function rebuildWorkLogFromChanges(
  taskKey: string,
  taskTitle: string,
  changes: TaskFieldChange[],
  terminology: Terminology = DEFAULT_TERMINOLOGY,
): { title: string; detail: string } | null {
  if (changes.length === 0) return null;
  return {
    title: `${taskKey} · Fields Updated (${changes.length}) · ${summarizeFieldChanges(changes)}`,
    detail: [
      `**${terminology.task.singular}:** ${taskKey} · ${taskTitle}`,
      '',
      ...changes.map(formatChangeLine),
    ].join('\n'),
  };
}
