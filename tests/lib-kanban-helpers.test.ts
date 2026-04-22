import { describe, expect, it } from 'vitest';

import {
  boardStatusLabel,
  buildUpdates,
  getBoardFlowStatuses,
  getMobileBoardStatuses,
  type KanbanColumns,
  type KanbanTask,
  moveTask,
  queueTaskExecutionOptimistically,
  resolveDisplayEngine,
  shouldShowHoldLane,
  toKanbanTask,
} from '@/lib/kanban-helpers';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

function makeTask(overrides: Partial<KanbanTask> & { id: string; sortOrder: string }): KanbanTask {
  return {
    taskKey: 'T-1',
    title: 'Task',
    note: null,
    status: 'todo',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    labels: [],
    ...overrides,
  };
}

function emptyColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

describe('kanban-helpers', () => {
  describe('board presentation helpers', () => {
    it('labels todo as Planned for board copy', () => {
      expect(boardStatusLabel('todo')).toBe('Planned');
    });

    it('uses kitchen status labels when terminology is provided', () => {
      expect(boardStatusLabel('ready', KITCHEN_TERMINOLOGY)).toBe('Pass');
      expect(boardStatusLabel('done', KITCHEN_TERMINOLOGY)).toBe('Order Up');
      expect(boardStatusLabel('hold', KITCHEN_TERMINOLOGY)).toBe("86'd");
    });

    it('returns the default board flow without Hold', () => {
      expect(getBoardFlowStatuses()).toEqual(['inbox', 'todo', 'ready', 'done']);
    });

    it('hides the Hold lane when the board has no hold tasks', () => {
      expect(shouldShowHoldLane(emptyColumns())).toBe(false);
    });

    it('shows the Hold lane when the board has hold tasks', () => {
      const columns = {
        ...emptyColumns(),
        hold: [makeTask({ id: 'hold-1', status: 'hold', sortOrder: 'a0' })],
      };

      expect(shouldShowHoldLane(columns)).toBe(true);
    });

    it('keeps mobile tabs to the main flow when Hold is empty', () => {
      expect(getMobileBoardStatuses(emptyColumns(), 'todo')).toEqual([
        'inbox',
        'todo',
        'ready',
        'done',
      ]);
    });

    it('keeps Hold reachable on mobile when Hold is active', () => {
      expect(getMobileBoardStatuses(emptyColumns(), 'hold')).toEqual([
        'inbox',
        'todo',
        'ready',
        'done',
        'hold',
      ]);
    });
  });

  describe('moveTask', () => {
    it('moves task within the same column', () => {
      const columns = {
        ...emptyColumns(),
        todo: [
          makeTask({ id: '1', sortOrder: 'a0' }),
          makeTask({ id: '2', sortOrder: 'b00' }),
          makeTask({ id: '3', sortOrder: 'c00' }),
        ],
      };

      const result = moveTask(columns, '3', 'todo', 0);
      expect(result.changed).toBe(true);
      expect(result.next.todo[0].id).toBe('3');
      expect(result.next.todo[1].id).toBe('1');
      expect(result.next.todo[2].id).toBe('2');
    });

    it('moves task across columns', () => {
      const columns = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', sortOrder: 'a0', status: 'todo' })],
        done: [makeTask({ id: '2', sortOrder: 'a0', status: 'done' })],
      };

      const result = moveTask(columns, '1', 'done', 1);
      expect(result.changed).toBe(true);
      expect(result.next.todo).toHaveLength(0);
      expect(result.next.done).toHaveLength(2);
      expect(result.next.done[1].id).toBe('1');
      expect(result.next.done[1].status).toBe('done');
    });

    it('returns changed=false when task not found', () => {
      const columns = emptyColumns();
      const result = moveTask(columns, 'nonexistent', 'todo', 0);
      expect(result.changed).toBe(false);
    });

    it('assigns a new sortOrder to the moved task', () => {
      const columns = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', sortOrder: 'a0' }), makeTask({ id: '2', sortOrder: 'c00' })],
      };

      const result = moveTask(columns, '2', 'todo', 0);
      expect(result.changed).toBe(true);
      const movedTask = result.next.todo[0];
      expect(movedTask.id).toBe('2');
      expect(movedTask.sortOrder < 'a0').toBe(true);
    });

    it('rebalances duplicate sortOrders when moving into the middle of a duplicate run', () => {
      const columns = {
        ...emptyColumns(),
        todo: [
          makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0' }),
          makeTask({ id: '2', taskKey: 'T-2', sortOrder: 'a0' }),
          makeTask({ id: '3', taskKey: 'T-3', sortOrder: 'b00' }),
        ],
      };

      const result = moveTask(columns, '3', 'todo', 1);

      expect(result.changed).toBe(true);
      expect(result.next.todo.map((task) => task.id)).toEqual(['1', '3', '2']);
      expect(new Set(result.next.todo.map((task) => task.sortOrder)).size).toBe(3);
      expect(result.next.todo[0].sortOrder < result.next.todo[1].sortOrder).toBe(true);
      expect(result.next.todo[1].sortOrder < result.next.todo[2].sortOrder).toBe(true);
    });
  });

  describe('buildUpdates', () => {
    it('detects sortOrder changes', () => {
      const prev = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0' })],
      };
      const next = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'b00' })],
      };

      const updates = buildUpdates(prev, next);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        id: '1',
        taskKey: 'T-1',
        status: 'todo',
        sortOrder: 'b00',
      });
    });

    it('detects status changes', () => {
      const prev = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0', status: 'todo' })],
      };
      const next = {
        ...emptyColumns(),
        done: [makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0', status: 'done' })],
      };

      const updates = buildUpdates(prev, next);
      expect(updates).toHaveLength(1);
      expect(updates[0].status).toBe('done');
    });

    it('returns empty when nothing changed', () => {
      const columns = {
        ...emptyColumns(),
        todo: [makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0' })],
      };
      const updates = buildUpdates(columns, columns);
      expect(updates).toHaveLength(0);
    });

    it('produces only 1 update for a single-task move', () => {
      const prev = {
        ...emptyColumns(),
        todo: [
          makeTask({ id: '1', taskKey: 'T-1', sortOrder: 'a0' }),
          makeTask({ id: '2', taskKey: 'T-2', sortOrder: 'b00' }),
          makeTask({ id: '3', taskKey: 'T-3', sortOrder: 'c00' }),
        ],
      };

      const moved = moveTask(prev, '3', 'todo', 1);
      expect(moved.changed).toBe(true);
      const updates = buildUpdates(prev, moved.next);
      expect(updates).toHaveLength(1);
      expect(updates[0].id).toBe('3');
    });
  });

  describe('queueTaskExecutionOptimistically', () => {
    it('keeps a non-todo task in place and marks it queued', () => {
      const columns = {
        ...emptyColumns(),
        ready: [
          makeTask({
            id: '1',
            taskKey: 'PROJ-1',
            status: 'ready',
            sortOrder: 'a0',
            archivedAt: '2026-03-10T10:00:00.000Z',
          }),
        ],
        todo: [makeTask({ id: '2', taskKey: 'PROJ-2', status: 'todo', sortOrder: 'a0' })],
      };

      const result = queueTaskExecutionOptimistically(
        columns,
        'PROJ-1',
        '2026-03-13T12:00:00.000Z',
      );

      expect(result.changed).toBe(true);
      expect(result.next.ready).toHaveLength(1);
      expect(result.next.todo).toHaveLength(1);
      expect(result.next.ready[0].taskKey).toBe('PROJ-1');
      expect(result.next.ready[0].status).toBe('ready');
      expect(result.next.ready[0].runState).toBe('queued');
      expect(result.next.ready[0].runStateUpdatedAt).toBe('2026-03-13T12:00:00.000Z');
      expect(result.next.ready[0].archivedAt).toBeNull();
    });

    it('updates a todo task in place when it is already in todo', () => {
      const columns = {
        ...emptyColumns(),
        todo: [
          makeTask({
            id: '1',
            taskKey: 'PROJ-1',
            status: 'todo',
            sortOrder: 'a0',
            runState: null,
            runStateUpdatedAt: null,
          }),
        ],
      };

      const result = queueTaskExecutionOptimistically(
        columns,
        'PROJ-1',
        '2026-03-13T12:05:00.000Z',
      );

      expect(result.changed).toBe(true);
      expect(result.next.todo).toHaveLength(1);
      expect(result.next.todo[0].taskKey).toBe('PROJ-1');
      expect(result.next.todo[0].runState).toBe('queued');
      expect(result.next.todo[0].runStateUpdatedAt).toBe('2026-03-13T12:05:00.000Z');
    });
  });

  describe('resolveDisplayEngine', () => {
    it('does not fall back to board presets when task engine is empty', () => {
      expect(resolveDisplayEngine(null, 'todo', null)).toBeNull();
    });
  });

  describe('toKanbanTask', () => {
    it('preserves multiple labels in order', () => {
      const task = toKanbanTask(
        {
          id: 'task-1',
          taskKey: 'PROJ-1',
          title: 'Task',
          note: null,
          sortOrder: 'a0',
          taskPriority: 'none',
          dueAt: null,
          engine: null,
          runState: 'queued',
          runStateUpdatedAt: new Date('2026-03-10T12:05:00.000Z'),
          archivedAt: null,
          updatedAt: new Date('2026-03-10T12:00:00.000Z'),
          project: null,
          labels: [
            { id: 'label-1', name: 'Bug', color: 'red' },
            { id: 'label-2', name: 'Frontend', color: '#228be6' },
          ],
        } as never,
        'todo',
      ) as unknown as { labels?: Array<{ id: string; name: string; color: string }> };

      expect(task.labels).toEqual([
        { id: 'label-1', name: 'Bug', color: 'red' },
        { id: 'label-2', name: 'Frontend', color: '#228be6' },
      ]);
      expect((task as never as { runState?: string | null }).runState).toBe('queued');
      expect((task as never as { runStateUpdatedAt?: string | null }).runStateUpdatedAt).toBe(
        '2026-03-10T12:05:00.000Z',
      );
    });

    it('preserves branch metadata for downstream telegram actions', () => {
      const task = toKanbanTask(
        {
          id: 'task-1',
          taskKey: 'PROJ-1',
          title: 'Task',
          branch: 'task/proj-1/implement-auth',
          note: null,
          sortOrder: 'a0',
          taskPriority: 'none',
          dueAt: null,
          engine: 'codex',
          runState: null,
          runStateUpdatedAt: null,
          archivedAt: null,
          updatedAt: new Date('2026-03-10T12:00:00.000Z'),
          project: null,
          labels: [],
        } as never,
        'todo',
      ) as unknown as { branch?: string | null };

      expect(task.branch).toBe('task/proj-1/implement-auth');
    });
  });
});
