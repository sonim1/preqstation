// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BoardNotificationSync } from '@/app/components/board-notification-sync';
import { KanbanStoreProvider, useKanbanColumns } from '@/app/components/kanban-store-provider';
import type {
  TaskCompletionNotificationItem,
  TaskNotificationItem,
} from '@/app/components/task-notification-drawer';
import { useTaskNotificationStore } from '@/app/components/task-notification-store';
import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

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
      buildTask({ id: 'task-1', taskKey: 'PROJ-327', sortOrder: 'a0' }),
      buildTask({ id: 'task-2', taskKey: 'PROJ-328', sortOrder: 'b0' }),
    ],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

function makeNotification(
  overrides: Partial<TaskCompletionNotificationItem> = {},
): TaskNotificationItem {
  return {
    id: 'notif-1',
    type: 'task',
    projectId: 'project-1',
    taskId: 'task-1',
    taskKey: 'PROJ-327',
    taskTitle: 'Add browser notifications',
    statusFrom: 'todo',
    statusTo: 'ready',
    readAt: null,
    createdAt: '2026-04-08T05:00:00.000Z',
    ...overrides,
  };
}

function BoardFlagProbe() {
  const columns = useKanbanColumns();

  return (
    <div>
      {columns.todo.map((task) => (
        <output key={task.taskKey} data-testid={`flag-${task.taskKey}`}>
          {String(Boolean(task.hasUnreadNotification))}
        </output>
      ))}
    </div>
  );
}

describe('app/components/board-notification-sync', () => {
  beforeEach(() => {
    useTaskNotificationStore.setState(useTaskNotificationStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it('syncs unread task notification counts into board task flags', async () => {
    const firstNotification = makeNotification({ id: 'notif-1', taskKey: 'PROJ-327' });
    const secondNotification = makeNotification({ id: 'notif-2', taskKey: 'PROJ-327' });

    render(
      <KanbanStoreProvider initialColumns={buildColumns()} initialFocusedTask={null}>
        <BoardNotificationSync />
        <BoardFlagProbe />
      </KanbanStoreProvider>,
    );

    expect(screen.getByTestId('flag-PROJ-327').textContent).toBe('false');

    act(() => {
      useTaskNotificationStore.getState().hydrateUnreadPage({
        notifications: [firstNotification, secondNotification],
        total: 2,
        offset: 0,
        limit: 20,
        hasMore: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('flag-PROJ-327').textContent).toBe('true');
    });

    act(() => {
      useTaskNotificationStore.getState().beginMarkRead(firstNotification);
      useTaskNotificationStore.getState().finishMarkRead(firstNotification);
    });

    await waitFor(() => {
      expect(screen.getByTestId('flag-PROJ-327').textContent).toBe('true');
    });

    act(() => {
      useTaskNotificationStore.getState().beginMarkRead(secondNotification);
      useTaskNotificationStore.getState().finishMarkRead(secondNotification);
    });

    await waitFor(() => {
      expect(screen.getByTestId('flag-PROJ-327').textContent).toBe('false');
    });
  });
});
