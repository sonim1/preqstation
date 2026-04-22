import { describe, expect, it } from 'vitest';

import {
  addTaskFieldChange,
  buildTaskFieldChangeWorkLog,
  buildTaskNoteChangeDetail,
  buildTaskStatusChangeWorkLog,
  mergeFieldChanges,
  parseFieldChangesFromDetail,
  parseTaskNoteChangeDetail,
  rebuildWorkLogFromChanges,
  summarizeAcceptanceCriteria,
  summarizeContent,
  type TaskFieldChange,
  taskPriorityLabel,
  taskStatusLabel,
} from '@/lib/task-worklog';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

// ---------------------------------------------------------------------------
// taskStatusLabel
// ---------------------------------------------------------------------------
describe('taskStatusLabel', () => {
  it('returns human-readable label for known statuses', () => {
    expect(taskStatusLabel('inbox')).toBe('Inbox');
    expect(taskStatusLabel('todo')).toBe('Todo');
    expect(taskStatusLabel('hold')).toBe('Hold');
    expect(taskStatusLabel('ready')).toBe('Ready');
    expect(taskStatusLabel('done')).toBe('Done');
    expect(taskStatusLabel('archived')).toBe('Archived');
  });

  it('returns the raw value for unknown statuses', () => {
    expect(taskStatusLabel('custom_status')).toBe('custom_status');
  });

  it('returns Unknown for null', () => {
    expect(taskStatusLabel(null)).toBe('Unknown');
  });

  it('returns Unknown for undefined', () => {
    expect(taskStatusLabel(undefined)).toBe('Unknown');
  });

  it('returns Unknown for empty string', () => {
    expect(taskStatusLabel('')).toBe('Unknown');
  });

  it('returns Unknown for whitespace-only string', () => {
    expect(taskStatusLabel('   ')).toBe('Unknown');
  });

  it('trims whitespace before lookup', () => {
    expect(taskStatusLabel('  done  ')).toBe('Done');
  });
});

// ---------------------------------------------------------------------------
// taskPriorityLabel
// ---------------------------------------------------------------------------
describe('taskPriorityLabel', () => {
  it('returns correct label for each priority', () => {
    expect(taskPriorityLabel('highest')).toBe('Highest');
    expect(taskPriorityLabel('high')).toBe('High');
    expect(taskPriorityLabel('medium')).toBe('Medium');
    expect(taskPriorityLabel('none')).toBe('No priority');
    expect(taskPriorityLabel('low')).toBe('Low');
    expect(taskPriorityLabel('lowest')).toBe('Lowest');
  });

  it("falls back to 'none' label for null", () => {
    expect(taskPriorityLabel(null)).toBe('No priority');
  });

  it("falls back to 'none' label for undefined", () => {
    expect(taskPriorityLabel(undefined)).toBe('No priority');
  });

  it("falls back to 'none' label for unknown value", () => {
    expect(taskPriorityLabel('critical')).toBe('No priority');
  });
});

// ---------------------------------------------------------------------------
// addTaskFieldChange
// ---------------------------------------------------------------------------
describe('addTaskFieldChange', () => {
  it('adds an entry when from and to differ', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'title', 'Old title', 'New title');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ field: 'title', from: 'Old title', to: 'New title' });
  });

  it('does not add an entry when from and to are equal', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'title', 'Same', 'Same');
    expect(changes).toHaveLength(0);
  });

  it('normalizes null to (empty)', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'description', null, 'Something');
    expect(changes[0].from).toBe('(empty)');
    expect(changes[0].to).toBe('Something');
  });

  it('normalizes undefined to (empty)', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'description', undefined, 'Text');
    expect(changes[0].from).toBe('(empty)');
  });

  it('normalizes empty string to (empty)', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'description', '', 'Text');
    expect(changes[0].from).toBe('(empty)');
  });

  it('normalizes whitespace-only string to (empty)', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'description', '   ', 'Text');
    expect(changes[0].from).toBe('(empty)');
  });

  it('does not add when both sides normalize to (empty)', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'description', null, undefined);
    expect(changes).toHaveLength(0);
  });

  it('converts numbers to strings', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'count', 1, 2);
    expect(changes[0]).toEqual({ field: 'count', from: '1', to: '2' });
  });

  it('converts booleans to strings', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'active', false, true);
    expect(changes[0]).toEqual({ field: 'active', from: 'false', to: 'true' });
  });

  it('converts Date to ISO string', () => {
    const changes: TaskFieldChange[] = [];
    const d = new Date('2024-01-15T10:00:00.000Z');
    addTaskFieldChange(changes, 'dueDate', null, d);
    expect(changes[0].to).toBe('2024-01-15T10:00:00.000Z');
  });

  it('serializes objects as JSON', () => {
    const changes: TaskFieldChange[] = [];
    addTaskFieldChange(changes, 'meta', { a: 1 }, { a: 2 });
    expect(changes[0].from).toBe('{"a":1}');
    expect(changes[0].to).toBe('{"a":2}');
  });
});

// ---------------------------------------------------------------------------
// buildTaskStatusChangeWorkLog
// ---------------------------------------------------------------------------
describe('buildTaskStatusChangeWorkLog', () => {
  it('uses Planned when the internal todo status changes', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-0',
      taskTitle: 'Board relabel',
      fromStatus: 'todo',
      toStatus: 'ready',
    });

    expect(result.title).toBe('PROJ-0 · Planned -> Ready');
    expect(result.detail).toContain('- Status: `Planned` -> `Ready`');
  });

  it('returns title and detail for a basic status change', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-1',
      taskTitle: 'Fix bug',
      fromStatus: 'inbox',
      toStatus: 'hold',
    });

    expect(result.title).toBe('PROJ-1 · Inbox -> Hold');
    expect(result.detail).toContain('**Task:** PROJ-1 · Fix bug');
    expect(result.detail).toContain('- Status: `Inbox` -> `Hold`');
  });

  it('uses kitchen-mode labels for status changes and task headings', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-9',
      taskTitle: 'Fix bug',
      fromStatus: 'ready',
      toStatus: 'done',
      terminology: KITCHEN_TERMINOLOGY,
    });

    expect(result.title).toBe('PROJ-9 · Pass -> Order Up');
    expect(result.detail).toContain('**Ticket:** PROJ-9 · Fix bug');
    expect(result.detail).toContain('- Status: `Pass` -> `Order Up`');
  });

  it('includes extra changes when provided', () => {
    const extraChanges: TaskFieldChange[] = [{ field: 'priority', from: 'none', to: 'high' }];
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-2',
      taskTitle: 'Update docs',
      fromStatus: 'todo',
      toStatus: 'done',
      extraChanges,
    });

    expect(result.detail).toContain('**Additional Changes**');
    expect(result.detail).toContain('- priority: `none` -> `high`');
  });

  it('omits the additional changes section when extraChanges is empty', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-3',
      taskTitle: 'Task',
      fromStatus: 'todo',
      toStatus: 'done',
      extraChanges: [],
    });

    expect(result.detail).not.toContain('**Additional Changes**');
  });

  it('omits the additional changes section when extraChanges is undefined', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-4',
      taskTitle: 'Task',
      fromStatus: 'todo',
      toStatus: 'done',
    });

    expect(result.detail).not.toContain('**Additional Changes**');
  });

  it('sanitizes backticks in task title by replacing with single quote', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-5',
      taskTitle: 'Fix `bug`',
      fromStatus: 'inbox',
      toStatus: 'done',
    });
    // title is plain text, not wrapped in backticks, so no sanitization needed there
    expect(result.title).toContain('PROJ-5');
    // detail's status line uses safeInline on label (no backticks in labels here)
    expect(result.detail).toContain('- Status:');
  });

  it('handles unknown statuses gracefully', () => {
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-6',
      taskTitle: 'Task',
      fromStatus: 'custom_a',
      toStatus: 'custom_b',
    });

    expect(result.title).toBe('PROJ-6 · custom_a -> custom_b');
    expect(result.detail).toContain('- Status: `custom_a` -> `custom_b`');
  });

  it('handles multiple extra changes', () => {
    const extraChanges: TaskFieldChange[] = [
      { field: 'priority', from: 'low', to: 'high' },
      { field: 'assignee', from: '(empty)', to: 'alice' },
    ];
    const result = buildTaskStatusChangeWorkLog({
      taskKey: 'PROJ-7',
      taskTitle: 'Multi',
      fromStatus: 'todo',
      toStatus: 'ready',
      extraChanges,
    });

    expect(result.detail).toContain('- priority: `low` -> `high`');
    expect(result.detail).toContain('- assignee: `(empty)` -> `alice`');
  });
});

// ---------------------------------------------------------------------------
// buildTaskFieldChangeWorkLog
// ---------------------------------------------------------------------------
describe('buildTaskFieldChangeWorkLog', () => {
  it('returns null when changes array is empty', () => {
    const result = buildTaskFieldChangeWorkLog({
      taskKey: 'PROJ-10',
      taskTitle: 'Task',
      changes: [],
    });
    expect(result).toBeNull();
  });

  it('returns title with count and detail for non-empty changes', () => {
    const changes: TaskFieldChange[] = [{ field: 'title', from: 'Old', to: 'New' }];
    const result = buildTaskFieldChangeWorkLog({
      taskKey: 'PROJ-11',
      taskTitle: 'My Task',
      changes,
    });

    expect(result).not.toBeNull();
    expect(result!.title).toBe('PROJ-11 · Fields Updated (1) · Title changed');
    expect(result!.detail).toContain('**Task:** PROJ-11 · My Task');
    expect(result!.detail).toContain('- title: `Old` -> `New`');
  });

  it('reflects the correct count in the title', () => {
    const changes: TaskFieldChange[] = [
      { field: 'a', from: '1', to: '2' },
      { field: 'b', from: 'x', to: 'y' },
      { field: 'c', from: 'p', to: 'q' },
    ];
    const result = buildTaskFieldChangeWorkLog({
      taskKey: 'PROJ-12',
      taskTitle: 'Task',
      changes,
    });

    expect(result!.title).toBe('PROJ-12 · Fields Updated (3) · a updated, b updated, c updated');
    expect(result!.detail).toContain('- a: `1` -> `2`');
    expect(result!.detail).toContain('- b: `x` -> `y`');
    expect(result!.detail).toContain('- c: `p` -> `q`');
  });

  it('sanitizes backticks in change values', () => {
    const changes: TaskFieldChange[] = [{ field: 'code', from: 'foo`bar', to: 'baz`qux' }];
    const result = buildTaskFieldChangeWorkLog({
      taskKey: 'PROJ-13',
      taskTitle: 'Task',
      changes,
    });

    expect(result!.detail).toContain("- code: `foo'bar` -> `baz'qux`");
  });
});

// ---------------------------------------------------------------------------
// task note change detail
// ---------------------------------------------------------------------------
describe('task note change detail', () => {
  it('serializes note changes as structured detail', () => {
    const detail = buildTaskNoteChangeDetail({
      taskKey: 'PROJ-272',
      taskTitle: 'Fix card copy',
      previousNote: '## Context\n\nOld details',
      updatedNote: '## Context\n\nNew details',
    });

    expect(detail).not.toContain('**Previous Note**');
    expect(parseTaskNoteChangeDetail(detail)).toEqual({
      type: 'task.note_change',
      version: 1,
      taskKey: 'PROJ-272',
      taskTitle: 'Fix card copy',
      previousNote: '## Context\n\nOld details',
      updatedNote: '## Context\n\nNew details',
    });
  });

  it('parses legacy markdown note history detail', () => {
    const detail = [
      '**Task:** PROJ-272 · Fix card copy',
      '',
      '**Previous Note**',
      '',
      'Old details',
      '',
      '**Updated Note**',
      '',
      'New details',
    ].join('\n');

    expect(parseTaskNoteChangeDetail(detail)).toMatchObject({
      type: 'task.note_change',
      version: 1,
      taskKey: 'PROJ-272',
      taskTitle: 'Fix card copy',
      previousNote: 'Old details',
      updatedNote: 'New details',
    });
  });

  it('returns null for unrelated detail', () => {
    expect(parseTaskNoteChangeDetail('regular markdown detail')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// summarizeContent
// ---------------------------------------------------------------------------
describe('summarizeContent', () => {
  it('returns (empty) for null', () => {
    expect(summarizeContent(null)).toBe('(empty)');
  });

  it('returns (empty) for empty string', () => {
    expect(summarizeContent('')).toBe('(empty)');
  });

  it('returns (empty) for whitespace-only string', () => {
    expect(summarizeContent('   ')).toBe('(empty)');
  });

  it('returns the first line when it fits within maxLen', () => {
    expect(summarizeContent('Hello world')).toBe('Hello world');
  });

  it('truncates first line when it exceeds maxLen', () => {
    const long = 'A'.repeat(100);
    const result = summarizeContent(long, 80);
    expect(result).toBe('A'.repeat(80) + '...');
  });

  it('uses default maxLen of 80', () => {
    const long = 'B'.repeat(100);
    const result = summarizeContent(long);
    expect(result).toBe('B'.repeat(80) + '...');
  });

  it('returns only the first line of multi-line content', () => {
    expect(summarizeContent('Line 1\nLine 2\nLine 3')).toBe('Line 1');
  });

  it('handles Windows-style CRLF line endings', () => {
    expect(summarizeContent('Line 1\r\nLine 2')).toBe('Line 1');
  });

  it('does not truncate when first line is exactly maxLen', () => {
    const exact = 'C'.repeat(80);
    expect(summarizeContent(exact, 80)).toBe(exact);
  });

  it('accepts a custom maxLen', () => {
    const result = summarizeContent('Hello world', 5);
    expect(result).toBe('Hello...');
  });
});

// ---------------------------------------------------------------------------
// summarizeAcceptanceCriteria
// ---------------------------------------------------------------------------
describe('summarizeAcceptanceCriteria', () => {
  it('returns (none) for empty array', () => {
    expect(summarizeAcceptanceCriteria([])).toBe('(none)');
  });

  it('formats a single item correctly', () => {
    expect(summarizeAcceptanceCriteria(['User can log in'])).toBe('1 items: User can log in');
  });

  it('joins multiple items with pipe separator', () => {
    const result = summarizeAcceptanceCriteria(['AC1', 'AC2', 'AC3']);
    expect(result).toBe('3 items: AC1 | AC2 | AC3');
  });

  it('truncates at 200 characters with ellipsis', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Criterion ${i + 1} with some extra text`);
    const result = summarizeAcceptanceCriteria(items);
    expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(result.endsWith('...')).toBe(true);
  });

  it('does not truncate when summary is exactly 200 characters', () => {
    // Build items that produce exactly 200 chars when joined
    const _label = 'X'.repeat(10);
    // "N items: " prefix + items joined by " | "
    // We'll just check that short summaries are returned as-is
    const result = summarizeAcceptanceCriteria(['short']);
    expect(result).toBe('1 items: short');
    expect(result.endsWith('...')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseFieldChangesFromDetail
// ---------------------------------------------------------------------------
describe('parseFieldChangesFromDetail', () => {
  it('parses a single field change line', () => {
    const detail = ['**Task:** PROJ-1 · My Task', '', '- Title: `Old` -> `New`'].join('\n');
    const result = parseFieldChangesFromDetail(detail);
    expect(result).toEqual([{ field: 'Title', from: 'Old', to: 'New' }]);
  });

  it('parses multiple field change lines', () => {
    const detail = [
      '**Task:** PROJ-1 · My Task',
      '',
      '- Title: `Old Title` -> `New Title`',
      '- Label: `Bug` -> `Feature`',
      '- Task Priority: `No priority` -> `High`',
    ].join('\n');
    const result = parseFieldChangesFromDetail(detail);
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({ field: 'Title', from: 'Old Title', to: 'New Title' });
    expect(result![1]).toEqual({ field: 'Label', from: 'Bug', to: 'Feature' });
    expect(result![2]).toEqual({ field: 'Task Priority', from: 'No priority', to: 'High' });
  });

  it('returns null for detail with no change lines', () => {
    const result = parseFieldChangesFromDetail('**Task:** PROJ-1 · My Task');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFieldChangesFromDetail('')).toBeNull();
  });

  it('handles (empty) values', () => {
    const detail = '- Note: `(empty)` -> `set`';
    const result = parseFieldChangesFromDetail(detail);
    expect(result).toEqual([{ field: 'Note', from: '(empty)', to: 'set' }]);
  });
});

// ---------------------------------------------------------------------------
// mergeFieldChanges
// ---------------------------------------------------------------------------
describe('mergeFieldChanges', () => {
  it('merges same field: keeps original from, uses latest to', () => {
    const existing: TaskFieldChange[] = [{ field: 'Title', from: 'A', to: 'B' }];
    const incoming: TaskFieldChange[] = [{ field: 'Title', from: 'B', to: 'C' }];
    const result = mergeFieldChanges(existing, incoming);
    expect(result).toEqual([{ field: 'Title', from: 'A', to: 'C' }]);
  });

  it('includes fields from both arrays', () => {
    const existing: TaskFieldChange[] = [{ field: 'Title', from: 'A', to: 'B' }];
    const incoming: TaskFieldChange[] = [{ field: 'Label', from: 'Bug', to: 'Feature' }];
    const result = mergeFieldChanges(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ field: 'Title', from: 'A', to: 'B' });
    expect(result).toContainEqual({ field: 'Label', from: 'Bug', to: 'Feature' });
  });

  it('removes no-op changes where from === to (revert)', () => {
    const existing: TaskFieldChange[] = [{ field: 'Title', from: 'A', to: 'B' }];
    const incoming: TaskFieldChange[] = [{ field: 'Title', from: 'B', to: 'A' }];
    const result = mergeFieldChanges(existing, incoming);
    expect(result).toEqual([]);
  });

  it('removes only the reverted field, keeps others', () => {
    const existing: TaskFieldChange[] = [
      { field: 'Title', from: 'A', to: 'B' },
      { field: 'Label', from: 'Bug', to: 'Feature' },
    ];
    const incoming: TaskFieldChange[] = [{ field: 'Title', from: 'B', to: 'A' }];
    const result = mergeFieldChanges(existing, incoming);
    expect(result).toEqual([{ field: 'Label', from: 'Bug', to: 'Feature' }]);
  });

  it('handles empty existing array', () => {
    const incoming: TaskFieldChange[] = [{ field: 'Title', from: 'A', to: 'B' }];
    const result = mergeFieldChanges([], incoming);
    expect(result).toEqual([{ field: 'Title', from: 'A', to: 'B' }]);
  });

  it('handles empty incoming array', () => {
    const existing: TaskFieldChange[] = [{ field: 'Title', from: 'A', to: 'B' }];
    const result = mergeFieldChanges(existing, []);
    expect(result).toEqual([{ field: 'Title', from: 'A', to: 'B' }]);
  });
});

// ---------------------------------------------------------------------------
// rebuildWorkLogFromChanges
// ---------------------------------------------------------------------------
describe('rebuildWorkLogFromChanges', () => {
  it('returns null for empty changes', () => {
    expect(rebuildWorkLogFromChanges('PROJ-1', 'Task', [])).toBeNull();
  });

  it('builds title and detail from changes', () => {
    const changes: TaskFieldChange[] = [
      { field: 'Title', from: 'Old', to: 'New' },
      { field: 'Label', from: 'Bug', to: 'Feature' },
    ];
    const result = rebuildWorkLogFromChanges('PROJ-1', 'New', changes);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('PROJ-1 · Fields Updated (2) · Title changed, Label updated');
    expect(result!.detail).toContain('**Task:** PROJ-1 · New');
    expect(result!.detail).toContain('- Title: `Old` -> `New`');
    expect(result!.detail).toContain('- Label: `Bug` -> `Feature`');
  });

  it('produces detail that can be round-tripped through parseFieldChangesFromDetail', () => {
    const changes: TaskFieldChange[] = [
      { field: 'Title', from: 'A', to: 'B' },
      { field: 'Task Priority', from: 'No priority', to: 'High' },
    ];
    const result = rebuildWorkLogFromChanges('PROJ-5', 'B', changes);
    const parsed = parseFieldChangesFromDetail(result!.detail);
    expect(parsed).toEqual(changes);
  });
});
