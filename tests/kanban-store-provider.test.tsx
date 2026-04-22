import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  KanbanStoreProvider,
  useApplyKanbanMove,
  useApplyOptimisticKanbanRunState,
  useFocusedTask,
  useHydrateKanbanStore,
  useKanbanColumns,
  useKanbanFocusedTaskKey,
  useKanbanReconciliationPaused,
  useRemoveKanbanTask,
  useSetFocusedTask,
  useSetKanbanReconciliationPaused,
  useUpsertKanbanSnapshots,
} from '@/app/components/kanban-store-provider';
import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';

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
    branch: 'task/proj-255/zustand-cleanup',
    note: '## Detail',
    projectId: 'project-1',
    labelIds: [],
    labels: [],
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
    ...overrides,
  };
}

describe('app/components/kanban-store-provider', () => {
  it('exposes focused selectors and action hooks for kanban consumers', () => {
    function Probe() {
      const columns = useKanbanColumns();
      const focusedTask = useFocusedTask();
      const focusedTaskKey = useKanbanFocusedTaskKey();
      const isReconciliationPaused = useKanbanReconciliationPaused();
      const hydrate = useHydrateKanbanStore();
      const applyMove = useApplyKanbanMove();
      const upsertSnapshots = useUpsertKanbanSnapshots();
      const setReconciliationPaused = useSetKanbanReconciliationPaused();
      const setFocusedTask = useSetFocusedTask();
      const removeTask = useRemoveKanbanTask();
      const applyOptimisticRunState = useApplyOptimisticKanbanRunState();

      return (
        <div
          data-todo-count={String(columns.todo.length)}
          data-focused-task-key={focusedTaskKey ?? ''}
          data-focused-task={focusedTask?.taskKey ?? ''}
          data-is-reconciliation-paused={String(isReconciliationPaused)}
          data-hydrate-type={typeof hydrate}
          data-apply-move-type={typeof applyMove}
          data-upsert-snapshots-type={typeof upsertSnapshots}
          data-set-reconciliation-paused-type={typeof setReconciliationPaused}
          data-set-focused-task-type={typeof setFocusedTask}
          data-remove-task-type={typeof removeTask}
          data-apply-optimistic-run-state-type={typeof applyOptimisticRunState}
        />
      );
    }

    const html = renderToStaticMarkup(
      <KanbanStoreProvider initialColumns={buildColumns()} initialFocusedTask={buildFocusedTask()}>
        <Probe />
      </KanbanStoreProvider>,
    );

    expect(html).toContain('data-todo-count="2"');
    expect(html).toContain('data-focused-task-key="PROJ-255"');
    expect(html).toContain('data-focused-task="PROJ-255"');
    expect(html).toContain('data-is-reconciliation-paused="false"');
    expect(html).toContain('data-hydrate-type="function"');
    expect(html).toContain('data-apply-move-type="function"');
    expect(html).toContain('data-upsert-snapshots-type="function"');
    expect(html).toContain('data-set-reconciliation-paused-type="function"');
    expect(html).toContain('data-set-focused-task-type="function"');
    expect(html).toContain('data-remove-task-type="function"');
    expect(html).toContain('data-apply-optimistic-run-state-type="function"');
  });
});
