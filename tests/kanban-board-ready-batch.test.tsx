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
  KanbanColumn: ({ status, headerActions }: { status: string; headerActions?: React.ReactNode }) =>
    React.createElement('section', {
      'data-column-status': status,
      'data-has-header-actions': String(Boolean(headerActions)),
    }),
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
}));

vi.mock('@/app/components/project-insight-modal', () => ({
  ProjectInsightModal: () => null,
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

function renderBoard(selectedProject: { id: string; name: string; projectKey: string } | null) {
  return renderToStaticMarkup(
    <MantineProvider>
      <KanbanBoard
        initialInboxTasks={[]}
        initialTodoTasks={[]}
        initialHoldTasks={[]}
        initialReadyTasks={[]}
        initialDoneTasks={[]}
        initialArchivedTasks={[]}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={selectedProject}
        enginePresets={null}
      />
    </MantineProvider>,
  );
}

describe('app/components/kanban-board ready batch wiring', () => {
  it('renders Ready and Done header menus only where batch actions are available', () => {
    useKanbanColumnsMock.mockReturnValue({
      ...emptyColumns(),
      ready: [makeTask({ id: 'ready-1', taskKey: 'PROJ-1', status: 'ready' })],
      done: [makeTask({ id: 'done-1', taskKey: 'PROJ-2', status: 'done' })],
    });

    const html = renderBoard({ id: 'project-1', name: 'Alpha', projectKey: 'PROJ' });

    expect(html).toContain('data-column-status="ready" data-has-header-actions="true"');
    expect(html).toContain('data-column-status="done" data-has-header-actions="true"');
    expect(html).toContain('data-column-status="todo" data-has-header-actions="false"');
  });

  it('keeps the Ready column passive on all-project boards', () => {
    useKanbanColumnsMock.mockReturnValue({
      ...emptyColumns(),
      ready: [makeTask({ id: 'ready-1', taskKey: 'PROJ-1', status: 'ready' })],
      done: [makeTask({ id: 'done-1', taskKey: 'PROJ-2', status: 'done' })],
    });

    const html = renderBoard(null);

    expect(html).toContain('data-column-status="ready" data-has-header-actions="false"');
    expect(html).toContain('data-column-status="done" data-has-header-actions="true"');
  });
});
