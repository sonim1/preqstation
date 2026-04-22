import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { QaRunView } from '@/lib/qa-runs';

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
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: ({ children, label }: { children: React.ReactNode; label?: React.ReactNode }) => (
      <div data-tooltip-label={label}>{children}</div>
    ),
  };
});

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
  KanbanArchiveDrawer: ({
    opened,
    tasks,
    total,
    query,
    isLoading,
    isLoadingMore,
    hasMore,
  }: {
    opened: boolean;
    tasks: Array<{ taskKey: string }>;
    total: number;
    query: string;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
  }) => (
    <div
      data-testid="kanban-archive-drawer"
      data-opened={String(opened)}
      data-task-count={String(tasks.length)}
      data-total={String(total)}
      data-query={query}
      data-loading={String(isLoading)}
      data-loading-more={String(isLoadingMore)}
      data-has-more={String(hasMore)}
    />
  ),
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
  ProjectInsightModal: ({
    opened,
    selectedProject,
  }: {
    opened: boolean;
    selectedProject: { projectKey: string } | null;
  }) => (
    <div
      data-testid="project-insight-modal"
      data-opened={String(opened)}
      data-project-key={selectedProject?.projectKey ?? ''}
    />
  ),
}));

vi.mock('@/app/components/ready-qa-actions', () => ({
  ReadyQaActions: () => (
    <button type="button" aria-label="Open QA runs">
      QA
    </button>
  ),
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

import { MantineProvider } from '@mantine/core';

import { buildArchivedTasksRequestPath, KanbanBoard } from '@/app/components/kanban-board';

function renderBoard({
  selectedProject,
  readyQaConfig = null,
  archivedCount = 0,
}: {
  selectedProject: { id: string; name: string; projectKey: string } | null;
  readyQaConfig?: {
    projectId: string;
    projectKey: string;
    projectName: string;
    branchName: string;
    runs: QaRunView[];
  } | null;
  archivedCount?: number;
}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <KanbanBoard
        initialInboxTasks={[]}
        initialTodoTasks={[]}
        initialHoldTasks={[]}
        initialReadyTasks={[]}
        initialDoneTasks={[]}
        initialArchivedTasks={[]}
        archivedCount={archivedCount}
        archiveProjectId={selectedProject?.id ?? null}
        editHrefBase="/board"
        projectOptions={[]}
        labelOptions={[]}
        selectedProject={selectedProject}
        enginePresets={null}
        readyQaConfig={readyQaConfig}
      />
    </MantineProvider>,
  );
}

describe('app/components/kanban-board action island', () => {
  it('renders project board QA beside the add control with tooltip labels', () => {
    const html = renderBoard({
      selectedProject: { id: '1', name: 'Alpha', projectKey: 'PROJ' },
      archivedCount: 12,
      readyQaConfig: {
        projectId: '1',
        projectKey: 'PROJ',
        projectName: 'Alpha',
        branchName: 'main',
        runs: [],
      },
    });
    const addIndex = html.indexOf('Add task');
    const insightIndex = html.indexOf('Open project insight');
    const qaIndex = html.indexOf('Open QA runs');
    const settingsIndex = html.indexOf('Open project settings');
    const boardRegionIndex = html.indexOf('kanban-board-region');
    const actionIslandAnchorIndex = html.indexOf('kanban-action-island-anchor');

    expect(html).toContain('data-tooltip-label="New Task"');
    expect(html).toContain('data-tooltip-label="Insight"');
    expect(html).toContain('data-tooltip-label="Settings"');
    expect(html).toContain('data-tooltip-label="Archived tasks"');
    expect(html).toContain('class="kanban-board-region"');
    expect(html).toContain('class="kanban-action-island-anchor"');
    expect(actionIslandAnchorIndex).toBeGreaterThan(boardRegionIndex);
    expect(qaIndex).toBeGreaterThan(addIndex);
    expect(insightIndex).toBeGreaterThan(qaIndex);
    expect(settingsIndex).toBeGreaterThan(insightIndex);
    expect(html).toContain('aria-label="Open QA runs"');
    expect(html).toContain('aria-label="Open project insight"');
    expect(html).toContain('aria-label="Open project settings"');
    expect(html).toContain('href="/project/PROJ"');
    expect(html).toContain('class="kanban-action-island-badge">12</span>');
    expect(html).toContain('data-total="12"');
    expect(html).toContain('data-task-count="0"');
  });

  it('omits the project settings action on all-projects boards', () => {
    const html = renderBoard({ selectedProject: null });

    expect(html).not.toContain('Open project settings');
    expect(html).not.toContain('Open QA runs');
    expect(html).not.toContain('Open project insight');
  });

  it('builds archived drawer requests against the archived route with scope, search, and pagination', () => {
    expect(
      buildArchivedTasksRequestPath({
        projectId: 'project-1',
        query: 'release archive filter',
        limit: 30,
        offset: 60,
      }),
    ).toBe('/api/todos/archived?projectId=project-1&q=release+archive+filter&limit=30&offset=60');

    expect(
      buildArchivedTasksRequestPath({
        projectId: null,
        query: '',
        limit: 30,
        offset: 0,
      }),
    ).toBe('/api/todos/archived?limit=30&offset=0');
  });
});
