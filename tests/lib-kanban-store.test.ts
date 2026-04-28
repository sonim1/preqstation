import { describe, expect, it } from 'vitest';

import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';
import { createKanbanStore, type EditableBoardTask, selectKanbanColumns } from '@/lib/kanban-store';

function buildTask(
  overrides: Partial<KanbanTask> & { id: string; taskKey: string; sortOrder: string },
): KanbanTask {
  const { id, taskKey, sortOrder, ...rest } = overrides;

  return {
    id,
    taskKey,
    branch: null,
    title: 'Task',
    note: null,
    status: 'todo',
    sortOrder,
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: '2026-03-24T00:00:00.000Z',
    archivedAt: null,
    labels: [],
    ...rest,
  };
}

function buildColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [
      buildTask({ id: 'task-1', taskKey: 'PROJ-255', sortOrder: 'a0' }),
      buildTask({ id: 'task-2', taskKey: 'PROJ-256', sortOrder: 'b0' }),
    ],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function buildFocusedTask(overrides: Partial<EditableBoardTask> = {}): EditableBoardTask {
  return {
    id: 'task-1',
    taskKey: 'PROJ-255',
    title: 'Task',
    branch: 'task/proj-255/justand-sayong',
    note: '## Detail',
    projectId: 'project-1',
    labelIds: [],
    labels: [],
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    dispatchTarget: null,
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
    ...overrides,
  };
}

describe('lib/kanban-store', () => {
  it('hydrates normalized board state and focused task detail from the server snapshot', () => {
    const store = createKanbanStore({
      columns: buildColumns(),
      focusedTask: buildFocusedTask(),
    });

    expect(store.getState().tasksByKey['PROJ-255']?.title).toBe('Task');
    expect(store.getState().columnTaskKeys.todo).toEqual(['PROJ-255', 'PROJ-256']);
    expect(store.getState().focusedTask?.taskKey).toBe('PROJ-255');
    expect(store.getState().focusedTaskKey).toBe('PROJ-255');
  });

  it('upserts returned snapshots into the board state', () => {
    const store = createKanbanStore({
      columns: buildColumns(),
      focusedTask: buildFocusedTask(),
    });

    store.getState().upsertSnapshots([
      buildTask({
        id: 'task-1',
        taskKey: 'PROJ-255',
        sortOrder: 'a0',
        status: 'ready',
        title: 'Reconciled title',
      }),
    ]);

    expect(store.getState().columnTaskKeys.todo).toEqual(['PROJ-256']);
    expect(store.getState().columnTaskKeys.ready).toEqual(['PROJ-255']);
    expect(store.getState().tasksByKey['PROJ-255']?.title).toBe('Reconciled title');
  });

  it('removes a task from the board state and clears focused detail when needed', () => {
    const store = createKanbanStore({
      columns: buildColumns(),
      focusedTask: buildFocusedTask(),
    });

    store.getState().removeTask('PROJ-255');

    expect(store.getState().tasksByKey['PROJ-255']).toBeUndefined();
    expect(store.getState().columnTaskKeys.todo).toEqual(['PROJ-256']);
    expect(store.getState().focusedTask).toBeNull();
    expect(store.getState().focusedTaskKey).toBeNull();
  });

  it('tracks reconciliation pause state separately from the normalized board snapshot', () => {
    const store = createKanbanStore({
      columns: buildColumns(),
      focusedTask: buildFocusedTask(),
    });

    expect(store.getState().isReconciliationPaused).toBe(false);

    store.getState().setReconciliationPaused(true);
    expect(store.getState().isReconciliationPaused).toBe(true);
    expect(store.getState().columnTaskKeys.todo).toEqual(['PROJ-255', 'PROJ-256']);

    store.getState().setReconciliationPaused(false);
    expect(store.getState().isReconciliationPaused).toBe(false);
  });

  it('returns a cached columns snapshot when the normalized state references are unchanged', () => {
    const store = createKanbanStore({
      columns: buildColumns(),
      focusedTask: buildFocusedTask(),
    });

    const state = store.getState();

    expect(selectKanbanColumns(state)).toBe(selectKanbanColumns(state));
  });
});
