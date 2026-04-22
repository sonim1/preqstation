import { MantineProvider } from '@mantine/core';
import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { KanbanTask } from '@/lib/kanban-helpers';

const useKanbanColumnsMock = vi.hoisted(() => vi.fn());
const setKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...props }, children),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/app/components/kanban-archive-drawer', () => ({
  KanbanArchiveDrawer: () => null,
}));

vi.mock('@/app/components/kanban-board-mobile', () => ({
  KanbanBoardMobile: () => null,
}));

vi.mock('@/app/components/kanban-column', () => ({
  KanbanColumn: ({
    status,
    tasks,
    statusLabel,
  }: {
    status: string;
    tasks: unknown[];
    statusLabel?: string;
  }) =>
    React.createElement(
      'section',
      {
        'data-column-status': status,
        'data-task-count': String(tasks.length),
      },
      statusLabel ?? status,
    ),
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
}));

vi.mock('@/app/components/ready-qa-actions', () => ({
  ReadyQaActions: () => React.createElement('div', null, 'qa-actions'),
}));

vi.mock('@/app/components/kanban-store-provider', () => ({
  useKanbanColumns: useKanbanColumnsMock,
  useKanbanStoreApi: () => ({
    getState: () => ({
      applyMove: vi.fn(() => []),
      applyOptimisticRunState: vi.fn(),
      hydrate: vi.fn(),
      removeTask: vi.fn(),
      upsertSnapshots: vi.fn(),
      focusedTask: null,
    }),
  }),
  useOpenFocusedTaskFromBoardTask: () => vi.fn(),
  useSetKanbanReconciliationPaused: () => setKanbanReconciliationPausedMock,
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
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
  }),
}));

import { KanbanBoard } from '@/app/components/kanban-board';

function makeTask(
  overrides: Partial<KanbanTask> & { id: string; taskKey: string; status: KanbanTask['status'] },
): KanbanTask {
  const { id, taskKey, status, ...rest } = overrides;

  return {
    id,
    taskKey,
    title: 'Task',
    note: null,
    status,
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date('2026-03-10T00:00:00.000Z').toISOString(),
    archivedAt: null,
    labels: [],
    ...rest,
  };
}

function renderBoard({
  holdTasks = [],
}: {
  holdTasks?: KanbanTask[];
} = {}) {
  useKanbanColumnsMock.mockReturnValue({
    inbox: [makeTask({ id: 'inbox-1', taskKey: 'PROJ-1', status: 'inbox' })],
    todo: [makeTask({ id: 'todo-1', taskKey: 'PROJ-2', status: 'todo' })],
    hold: holdTasks,
    ready: [makeTask({ id: 'ready-1', taskKey: 'PROJ-3', status: 'ready' })],
    done: [makeTask({ id: 'done-1', taskKey: 'PROJ-4', status: 'done' })],
    archived: [],
  });

  return renderToStaticMarkup(
    <MantineProvider>
      <KanbanBoard
        initialInboxTasks={[makeTask({ id: 'inbox-1', taskKey: 'PROJ-1', status: 'inbox' })]}
        initialTodoTasks={[makeTask({ id: 'todo-1', taskKey: 'PROJ-2', status: 'todo' })]}
        initialHoldTasks={holdTasks}
        initialReadyTasks={[makeTask({ id: 'ready-1', taskKey: 'PROJ-3', status: 'ready' })]}
        initialDoneTasks={[makeTask({ id: 'done-1', taskKey: 'PROJ-4', status: 'done' })]}
        initialArchivedTasks={[]}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={null}
        enginePresets={null}
      />
    </MantineProvider>,
  );
}

describe('app/components/kanban-board conditional Hold lane', () => {
  it('renders only the primary flow when Hold is empty', () => {
    const html = renderBoard();

    expect(html).toContain('Planned');
    expect(html).not.toContain('Todo');
    expect(html).not.toContain('data-column-status="hold"');
    expect(html).toMatch(
      /data-column-status="inbox"[\s\S]*data-column-status="todo"[\s\S]*data-column-status="ready"[\s\S]*data-column-status="done"/,
    );
  });

  it('renders Hold as a separate right-side lane when Hold has tasks', () => {
    const html = renderBoard({
      holdTasks: [makeTask({ id: 'hold-1', taskKey: 'PROJ-5', status: 'hold' })],
    });

    expect(html).toContain('data-column-status="hold"');
    expect(html).toContain('kanban-hold-rail');
    expect(html).toContain('kanban-hold-rail--compact');
    expect(html).toContain('kanban-hold-rail--fixed-width');
    expect(html).toMatch(
      /data-column-status="inbox"[\s\S]*data-column-status="todo"[\s\S]*data-column-status="ready"[\s\S]*data-column-status="done"[\s\S]*data-column-status="hold"/,
    );
  });
});
