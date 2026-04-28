import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

const useMobileTabSwipeMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/use-mobile-tab-swipe', () => ({
  useMobileTabSwipe: useMobileTabSwipeMock,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => React.createElement('div', null, title),
}));

vi.mock('@/app/components/kanban-card', () => ({
  KanbanCardContent: () => React.createElement('div', null, 'card'),
}));

vi.mock('@tabler/icons-react', () => ({
  IconCircleCheck: () => null,
  IconEye: () => null,
  IconInbox: () => null,
  IconListCheck: () => null,
  IconPlayerPause: () => null,
  IconRefresh: () => null,
}));

import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';

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

function emptyColumns(): KanbanColumns {
  return {
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  };
}

describe('KanbanBoardMobile swipe wiring', () => {
  it('uses the primary flow for swipe order when Hold is empty', () => {
    useMobileTabSwipeMock.mockReturnValue({
      onTouchStart: vi.fn(),
      onTouchEnd: vi.fn(),
    });

    const onTabChange = vi.fn();
    const columns = {
      ...emptyColumns(),
      todo: [makeTask({ id: '1', taskKey: 'PROJ-1', status: 'todo' })],
    };

    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={columns}
          activeTab="todo"
          onTabChange={onTabChange}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn() } as never}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          saveError={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(useMobileTabSwipeMock).toHaveBeenCalledWith(
      ['inbox', 'todo', 'ready', 'done'],
      'todo',
      onTabChange,
    );
    expect(html).toContain('touch-action:pan-y');
  });

  it('keeps Hold in the swipe order when Hold is active', () => {
    useMobileTabSwipeMock.mockReturnValue({
      onTouchStart: vi.fn(),
      onTouchEnd: vi.fn(),
    });

    const onTabChange = vi.fn();
    const columns = emptyColumns();

    renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={columns}
          activeTab="hold"
          onTabChange={onTabChange}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn() } as never}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          saveError={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(useMobileTabSwipeMock).toHaveBeenCalledWith(
      ['inbox', 'todo', 'hold', 'ready', 'done'],
      'hold',
      onTabChange,
    );
  });
});
