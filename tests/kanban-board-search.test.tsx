import { MantineProvider } from '@mantine/core';
import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoard } from '@/app/components/kanban-board';
import type { KanbanTask } from '@/lib/kanban-helpers';

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));
const useKanbanColumnsMock = vi.hoisted(() => vi.fn());
const setKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/match-media', () => ({
  subscribeMediaQuery: vi.fn(() => () => {}),
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

vi.mock('@/app/components/kanban-archive-drawer', () => ({
  KanbanArchiveDrawer: () => null,
}));

vi.mock('@/app/components/kanban-board-mobile', () => ({
  KanbanBoardMobile: () => null,
}));

vi.mock('@/app/components/kanban-column', () => ({
  KanbanColumn: ({ status, tasks }: { status: string; tasks: Array<{ taskKey: string }> }) =>
    React.createElement(
      'section',
      {
        'data-column-status': status,
      },
      tasks.map((task) => React.createElement('span', { key: task.taskKey }, task.taskKey)),
    ),
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
}));

vi.mock('@/app/components/ready-qa-actions', () => ({
  ReadyQaActions: () => null,
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

function emptyColumns() {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

describe('app/components/kanban-board search removal', () => {
  it('does not render a board search input inline', () => {
    useKanbanColumnsMock.mockReturnValue({
      ...emptyColumns(),
      todo: [makeTask({ id: 'todo-1', taskKey: 'LOCAL-1', status: 'todo' })],
    });

    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoard
          initialInboxTasks={[]}
          initialTodoTasks={[makeTask({ id: 'todo-1', taskKey: 'LOCAL-1', status: 'todo' })]}
          initialHoldTasks={[]}
          initialReadyTasks={[]}
          initialDoneTasks={[]}
          initialArchivedTasks={[]}
          editHrefBase="/board"
          projectOptions={[]}
          labelOptions={[]}
          selectedProject={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).not.toContain('placeholder="Search tasks"');
  });

  it('keeps rendering the local kanban columns without a search loading overlay', () => {
    useKanbanColumnsMock.mockReturnValue({
      ...emptyColumns(),
      todo: [makeTask({ id: 'todo-1', taskKey: 'LOCAL-1', status: 'todo' })],
    });

    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoard
          initialInboxTasks={[]}
          initialTodoTasks={[makeTask({ id: 'todo-1', taskKey: 'LOCAL-1', status: 'todo' })]}
          initialHoldTasks={[]}
          initialReadyTasks={[]}
          initialDoneTasks={[]}
          initialArchivedTasks={[]}
          editHrefBase="/board"
          projectOptions={[]}
          labelOptions={[]}
          selectedProject={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('LOCAL-1');
    expect(html).not.toContain('data-search-overlay="loading"');
    expect(html).not.toContain('Searching board...');
  });
});
