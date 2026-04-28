import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useSearchParamsMock = vi.hoisted(() => vi.fn(() => new URLSearchParams()));
const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const offlineBoardHydratorPropsMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => routerMock,
}));

vi.mock('@/app/components/task-panel-modal', () => ({
  TaskPanelModal: ({
    children,
    title,
    closeHref,
    size,
  }: {
    children: React.ReactNode;
    title: string;
    closeHref: string;
    size?: string;
  }) => (
    <div
      data-testid="task-panel-modal"
      data-title={title}
      data-close-href={closeHref}
      data-size={size ?? ''}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/app/components/kanban-board', () => ({
  KanbanBoard: ({
    archivedCount,
    archiveProjectId,
  }: {
    archivedCount: number;
    archiveProjectId: string | null;
  }) => (
    <div
      data-testid="kanban-board"
      data-archived-count={String(archivedCount)}
      data-archive-project-id={archiveProjectId ?? ''}
    >
      board
    </div>
  ),
}));

vi.mock('@/app/components/board-event-sync', () => ({
  BoardEventSync: ({ projectId }: { projectId: string | null }) => (
    <div data-testid="board-event-sync" data-project-id={projectId ?? ''} />
  ),
}));

vi.mock('@/app/components/offline-board-hydrator', () => ({
  OfflineBoardHydrator: (props: unknown) => {
    offlineBoardHydratorPropsMock(props);
    return <div data-testid="offline-board-hydrator" />;
  },
}));

vi.mock('@/app/components/task-copy-actions', () => ({
  TaskCopyActions: () => <div data-testid="task-copy-actions" />,
}));

vi.mock('@/app/components/task-edit-form', () => ({
  TaskEditForm: () => <div data-testid="task-edit-form" />,
  useTaskEditFormController: () => ({
    fieldRenderKey: 'task-edit-form:test',
    flushOnBlur: vi.fn(),
    formId: 'task-edit-form:test',
    markDirty: vi.fn(),
  }),
}));

import { BoardContent } from '@/app/components/board-content';

describe('BoardContent background image handling', () => {
  it('keeps the board on the default stage even when a project background is configured', () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());

    const html = renderToStaticMarkup(
      <MantineProvider>
        <BoardContent
          kanbanTasks={{
            inbox: [],
            todo: [],
            hold: [],
            ready: [],
            done: [],
            archived: [],
          }}
          editHrefBase="/board"
          boardHref="/board"
          telegramEnabled={false}
          projects={[]}
          todoLabels={[]}
          selectedProject={null}
          activePanel={null}
          editableTodo={null}
          taskPriorityOptions={[]}
          updateTodoAction={async () => ({ ok: true })}
          initialArchivedCount={12}
          archiveProjectId={null}
          bgImageUrl="https://example.com/board.jpg"
          bgImageCredit={{
            provider: 'openverse',
            creatorName: 'Jane Doe',
            creatorUrl: 'https://example.com/jane',
            sourceName: 'Flickr',
            sourceUrl: 'https://example.com/photo-1',
            license: 'CC BY 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          }}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="kanban-board"');
    expect(html).toContain('data-testid="kanban-store-provider"');
    expect(html).toContain('class="kanban-stage"');
    expect(html).not.toContain('has-bg-image');
    expect(html).not.toContain('--kanban-bg-image');
    expect(html).toContain('data-archived-count="12"');
    expect(html).toContain('data-archive-project-id=""');
    expect(html).not.toContain('class="kanban-bg-image"');
    expect(html).not.toContain('Photo credit');
    expect(html).not.toContain('Jane Doe · CC BY 4.0');
  });

  it('routes the task edit panel through the dedicated task modal shell', () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams('panel=task-edit&taskId=PROJ-245'));

    const html = renderToStaticMarkup(
      <MantineProvider>
        <BoardContent
          kanbanTasks={{
            inbox: [],
            todo: [],
            hold: [],
            ready: [],
            done: [],
            archived: [],
          }}
          editHrefBase="/board"
          boardHref="/board"
          telegramEnabled={false}
          projects={[]}
          todoLabels={[]}
          selectedProject={{ id: 'project-1', name: 'Preq Station', projectKey: 'PROJ' }}
          activePanel="task-edit"
          editableTodo={{
            id: 'task-1',
            taskKey: 'PROJ-245',
            title: 'Edit task panel refresh',
            branch: 'task/proj-245/improvement-the-edit-task-panel',
            note: '## Context',
            projectId: null,
            labelIds: [],
            labels: [],
            taskPriority: 'none',
            status: 'todo',
            engine: null,
            dispatchTarget: null,
            runState: null,
            runStateUpdatedAt: null,
            workLogs: [],
          }}
          taskPriorityOptions={[{ value: 'none', label: 'None' }]}
          updateTodoAction={async () => ({ ok: true })}
          initialArchivedCount={7}
          archiveProjectId="project-1"
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-testid="kanban-store-provider"');
    expect(html).toContain('data-title="Edit Task"');
    expect(html).toContain('data-close-href="/board"');
    expect(html).toContain('data-size="80rem"');
    expect(html).toContain('data-testid="offline-board-hydrator"');
    expect(html).toContain('data-archived-count="7"');
    expect(html).toContain('data-archive-project-id="project-1"');
    expect(html).toContain('data-project-id="project-1"');
    expect(html).not.toContain('data-testid="dashboard-panel-drawer"');
    expect(offlineBoardHydratorPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boardKey: 'PROJ',
      }),
    );
  });
});
