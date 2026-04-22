import { describe, expect, it } from 'vitest';

import type { KanbanTask } from '@/lib/kanban-helpers';
import {
  buildEditableBoardTaskPreview,
  createKanbanStore,
  type EditableBoardTask,
} from '@/lib/kanban-store';

function buildBoardTask(
  overrides: Partial<KanbanTask> & { id: string; taskKey: string; sortOrder: string },
): KanbanTask {
  const { id, taskKey, sortOrder, ...rest } = overrides;

  return {
    id,
    taskKey,
    branch: 'task/proj-300/fast-open',
    title: 'Fast open task',
    note: '## Context\nOpen immediately',
    status: 'todo',
    sortOrder,
    taskPriority: 'none',
    dueAt: null,
    engine: 'codex',
    runState: null,
    runStateUpdatedAt: null,
    project: { id: 'project-1', name: 'Preq Station', projectKey: 'PROJ' },
    updatedAt: '2026-03-30T00:00:00.000Z',
    archivedAt: null,
    labels: [{ id: 'label-1', name: 'Frontend', color: '#228be6' }],
    ...rest,
  };
}

function buildFocusedTask(overrides: Partial<EditableBoardTask> = {}): EditableBoardTask {
  return {
    id: 'task-1',
    taskKey: 'PROJ-300',
    title: 'Fast open task',
    branch: 'task/proj-300/fast-open',
    note: '## Context\nOpen immediately',
    projectId: 'project-1',
    labelIds: ['label-1'],
    labels: [{ id: 'label-1', name: 'Frontend', color: '#228be6' }],
    taskPriority: 'none',
    status: 'todo',
    engine: 'codex',
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
    ...overrides,
  };
}

describe('task edit panel fast open', () => {
  it('builds an editable preview from a kanban task snapshot', () => {
    const preview = buildEditableBoardTaskPreview(
      buildBoardTask({
        id: 'task-1',
        taskKey: 'PROJ-300',
        sortOrder: 'a0',
      }),
    );

    expect(preview).toEqual(
      expect.objectContaining({
        id: 'task-1',
        taskKey: 'PROJ-300',
        projectId: 'project-1',
        labelIds: ['label-1'],
      }),
    );
    expect(preview.workLogs).toEqual([]);
  });

  it('opens the focused task panel from a board snapshot in loading state', () => {
    const store = createKanbanStore({
      columns: {
        inbox: [],
        todo: [buildBoardTask({ id: 'task-1', taskKey: 'PROJ-300', sortOrder: 'a0' })],
        hold: [],
        ready: [],
        done: [],
        archived: [],
      },
      focusedTask: null,
    });

    store
      .getState()
      .openFocusedTaskFromBoardTask(
        buildBoardTask({ id: 'task-1', taskKey: 'PROJ-300', sortOrder: 'a0' }),
      );

    expect(store.getState().focusedTask?.taskKey).toBe('PROJ-300');
    expect(store.getState().focusedTaskDetailStatus).toBe('loading');
  });

  it('marks focused task detail as ready when hydrated detail arrives', () => {
    const store = createKanbanStore({
      columns: {
        inbox: [],
        todo: [buildBoardTask({ id: 'task-1', taskKey: 'PROJ-300', sortOrder: 'a0' })],
        hold: [],
        ready: [],
        done: [],
        archived: [],
      },
      focusedTask: null,
    });

    store
      .getState()
      .openFocusedTaskFromBoardTask(
        buildBoardTask({ id: 'task-1', taskKey: 'PROJ-300', sortOrder: 'a0' }),
      );
    store.getState().setFocusedTask(buildFocusedTask());

    expect(store.getState().focusedTaskDetailStatus).toBe('ready');
  });
});
