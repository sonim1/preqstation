import fs from 'node:fs';
import path from 'node:path';

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
    updatedAt: new Date('2026-03-09T00:00:00.000Z').toISOString(),
    archivedAt: null,
    labels: [],
  };
}

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('kanban empty lane', () => {
  it('renders compact decorative empty lanes for desktop and mobile empty lanes', () => {
    const columns: KanbanColumns = {
      inbox: [],
      todo: [makeTask('todo')],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    };

    const mobileHtml = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={columns}
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

    const desktopHtml = renderToStaticMarkup(
      <MantineProvider>
        <KanbanColumn
          status="inbox"
          tasks={[]}
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

    expect(mobileHtml).toContain('data-kanban-empty-lane="true"');
    expect(mobileHtml).toContain('kanban-empty-state--compact');
    expect(mobileHtml).not.toContain('data-kanban-empty-lane-arc="true"');
    expect(mobileHtml).not.toContain('No inbox tasks');
    expect(desktopHtml).toContain('data-kanban-empty-lane="true"');
    expect(desktopHtml).toContain('kanban-empty-state--compact');
    expect(desktopHtml).not.toContain('data-kanban-empty-lane-arc="true"');
    expect(desktopHtml).not.toContain('No inbox tasks');
  });

  it('keeps the empty-state top aura short and subdued', () => {
    const auraRule =
      globalsCss.match(/\.kanban-empty-state--compact::before\s*\{[\s\S]*?\}/)?.[0] ?? '';

    expect(globalsCss).toMatch(/\.kanban-empty-lane\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*\}/);
    expect(auraRule).toContain('height: clamp(32px, 8vh, 56px);');
    expect(auraRule).toContain('opacity: 0.52;');
    expect(auraRule).toContain('linear-gradient(');
    expect(globalsCss).not.toMatch(/\.kanban-empty-lane-arc\s*\{/);
  });
});
