import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';
import { KanbanColumn } from '@/app/components/kanban-column';
import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children, droppableId }: any) =>
    children(
      { innerRef: vi.fn(), droppableProps: { 'data-droppable-id': droppableId } },
      { isDraggingOver: false },
    ),
  Draggable: ({ children, draggableId }: any) =>
    children(
      {
        innerRef: vi.fn(),
        draggableProps: { style: {}, 'data-draggable-id': draggableId },
        dragHandleProps: {},
      },
      { isDragging: false, isDropAnimating: false },
    ),
}));

function makeTask(status: KanbanTask['status']): KanbanTask {
  return {
    id: `${status}-1`,
    taskKey: `PROJ-${status}`,
    title: 'Accessible card',
    note: null,
    status,
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date('2026-03-09T00:00:00.000Z').toISOString(),
    archivedAt: null,
    labels: [],
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

describe('kanban card accessibility', () => {
  it('renders desktop task cards with keyboard-reachable open semantics', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanColumn
          status="inbox"
          tasks={[makeTask('inbox')]}
          isPending={false}
          isMobile={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: () => {} } as any}
          onQuickMoveTask={() => {}}
          onDeleteTask={() => {}}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('role="link"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Open task PROJ-inbox Accessible card"');
  });

  it('renders mobile task cards with keyboard-reachable open semantics', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={{
            ...emptyColumns(),
            inbox: [makeTask('inbox')],
          }}
          activeTab="inbox"
          onTabChange={() => {}}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: () => {}, refresh: () => {} } as any}
          onQuickMoveTask={() => {}}
          onDeleteTask={() => {}}
          saveError={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('role="link"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Open task PROJ-inbox Accessible card"');
  });

  it('renders header actions beside the count badge without injecting body-top UI', () => {
    const Column = KanbanColumn as unknown as React.ComponentType<Record<string, unknown>>;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Column
          status="ready"
          tasks={[makeTask('ready')]}
          isPending={false}
          isMobile={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: () => {} }}
          onQuickMoveTask={() => {}}
          onDeleteTask={() => {}}
          enginePresets={null}
          countSlot={<span data-slot="legacy-count">1 ▾</span>}
          bodyTopSlot={<div data-slot="legacy-body-top">Move all 1 to Done?</div>}
          headerActions={
            <button type="button" data-slot="column-menu">
              menu
            </button>
          }
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-slot="column-menu"');
    expect(html).not.toContain('data-slot="legacy-count"');
    expect(html).not.toContain('data-slot="legacy-body-top"');
    expect(html.indexOf('data-slot="column-menu"')).toBeLessThan(html.indexOf('Accessible card'));
    expect(html).toContain('aria-label="Open task PROJ-ready Accessible card"');
  });
});
