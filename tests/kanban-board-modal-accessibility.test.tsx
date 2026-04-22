import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useKanbanColumnsMock = vi.hoisted(() =>
  vi.fn(() => ({
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  })),
);
const setKanbanReconciliationPausedMock = vi.hoisted(() => vi.fn());

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: ({
    title,
    closeButtonProps,
    children,
  }: {
    title?: React.ReactNode;
    closeButtonProps?: { 'aria-label'?: string };
    children?: React.ReactNode;
  }) => (
    <div data-modal-title={title} data-close-label={closeButtonProps?.['aria-label']}>
      {children}
    </div>
  ),
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArchive: () => null,
  IconBulb: () => null,
  IconPlus: () => null,
  IconSettings: () => null,
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
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/components/board-search-context', () => ({
  useBoardSearchQuery: () => ({ query: '' }),
}));

vi.mock('@/app/components/kanban-archive-drawer', () => ({
  KanbanArchiveDrawer: () => null,
}));

vi.mock('@/app/components/kanban-board-mobile', () => ({
  KanbanBoardMobile: () => null,
}));

vi.mock('@/app/components/kanban-column', () => ({
  KanbanColumn: () => null,
}));

vi.mock('@/app/components/kanban-quick-add', () => ({
  KanbanQuickAdd: () => null,
}));

vi.mock('@/app/components/project-insight-modal', () => ({
  ProjectInsightModal: () => null,
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

describe('app/components/kanban-board quick add modal accessibility', () => {
  it('passes a descriptive close label to the Add Task modal', () => {
    const html = renderToStaticMarkup(
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
        selectedProject={null}
        enginePresets={null}
      />,
    );

    expect(html).toContain('data-modal-title="Add Task"');
    expect(html).toContain('data-close-label="Close Add Task dialog"');
  });
});
