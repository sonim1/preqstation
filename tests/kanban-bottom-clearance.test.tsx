import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { BoardLoadingShell } from '@/app/components/board-loading-shell';
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

describe('kanban bottom clearance hooks', () => {
  it('renders the bottom-clearance and bottom-gradient hooks for mobile panels, desktop columns, and loading shell', () => {
    const columns: KanbanColumns = {
      inbox: [makeTask('inbox')],
      todo: [],
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

    const loadingHtml = renderToStaticMarkup(
      <MantineProvider>
        <BoardLoadingShell />
      </MantineProvider>,
    );

    expect(mobileHtml).toContain('kanban-bottom-clearance');
    expect(mobileHtml).toContain('kanban-bottom-gradient');
    expect(mobileHtml).toContain('kanban-mobile-refresh-indicator');
    expect(mobileHtml).toContain('kanban-mobile-tab-copy');
    expect(mobileHtml).toContain('kanban-mobile-tab-label');
    expect(mobileHtml).toContain('kanban-mobile-tab-count');
    expect(desktopHtml).toContain('kanban-column-list kanban-fill-height kanban-bottom-clearance');
    expect(desktopHtml).toContain('kanban-bottom-gradient');
    expect(loadingHtml).toContain('kanban-column-list kanban-fill-height kanban-bottom-clearance');
    expect(loadingHtml).toContain('kanban-bottom-gradient');
    expect(loadingHtml).toContain('data-board-loading-mobile-shell="true"');
    expect(loadingHtml).toContain(
      'kanban-mobile-panel-list kanban-fill-height kanban-bottom-clearance',
    );
    expect(mobileHtml).toContain('kanban-mobile-tab-bar');
    expect(loadingHtml).toContain('kanban-mobile-tab-bar');
    expect(mobileHtml.indexOf('kanban-mobile-panels')).toBeLessThan(
      mobileHtml.indexOf('kanban-mobile-tab-bar'),
    );
    expect(loadingHtml.indexOf('kanban-mobile-panels')).toBeLessThan(
      loadingHtml.indexOf('kanban-mobile-tab-bar'),
    );
    expect(mobileHtml).toContain(
      'kanban-mobile-panel-list kanban-fill-height kanban-bottom-clearance',
    );
  });

  it('renders explicit fill-height hooks for mobile empty states and desktop column lists', () => {
    const columns: KanbanColumns = {
      inbox: [],
      todo: [],
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

    expect(mobileHtml).toContain('kanban-mobile-panel-body');
    expect(mobileHtml).toContain('kanban-fill-height');
    expect(mobileHtml).toContain('kanban-empty-state--compact');
    expect(mobileHtml).toContain('data-kanban-empty-lane="true"');
    expect(desktopHtml).toContain('kanban-column-list kanban-fill-height');
    expect(desktopHtml).toContain('kanban-empty-state--compact');
    expect(desktopHtml).toContain('data-kanban-empty-lane="true"');
  });

  it('renders the mobile panel wrapper for an empty active tab', () => {
    const columns: KanbanColumns = {
      inbox: [makeTask('inbox')],
      todo: [],
      hold: [],
      ready: [],
      done: [],
      archived: [],
    };

    const mobileHtml = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={columns}
          activeTab="todo"
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

    expect(mobileHtml).toContain('kanban-mobile-panels');
    expect(mobileHtml).toContain('kanban-empty-state--compact');
    expect(mobileHtml).not.toContain('No planned tasks');
  });

  it('defines board-only empty-lane selectors for the top aurora seam treatment', () => {
    expect(globalsCss).toMatch(/\.kanban-empty-lane\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*\}/);
    expect(globalsCss).toMatch(/\.kanban-empty-state--compact::before\s*\{[\s\S]*filter:\s*blur\(/);
    expect(globalsCss).toMatch(/\.kanban-empty-state--compact::after\s*\{[\s\S]*height:\s*1px;/);
    expect(globalsCss).not.toMatch(/\.kanban-column-list\[data-empty-column='true'\]/);
    expect(globalsCss).not.toMatch(/\.kanban-mobile-panel-list\[data-empty-column='true'\]/);
  });

  it('keeps the mobile panel as a fixed shell and assigns vertical scroll to the inner body', () => {
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tabs \.mantine-Tabs-panel\[data-active\]\s*\{[\s\S]*min-height:\s*0;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-panel\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-panel-body\s*\{[\s\S]*flex:\s*1 1 0(?:px)?;[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-refresh-indicator\s*\{[\s\S]*height:\s*var\(--kanban-mobile-refresh-offset,\s*0px\);/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-refresh-indicator\[data-armed='true'\]\s+\.kanban-mobile-refresh-icon\s*\{[\s\S]*filter:\s*drop-shadow\(/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-refresh-indicator\[data-state='success'\]\s*\{[\s\S]*color:\s*var\(--ui-success\);/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-refresh-indicator\[data-state='success'\]\s+\.kanban-mobile-refresh-icon\s*\{[\s\S]*transform:\s*scale\(1\.02\);/,
    );
  });

  it('ties the bottom gradient height to the same clearance variable used by the board padding', () => {
    expect(globalsCss).not.toMatch(/\.kanban-column-body\.kanban-bottom-clearance\s*\{/);
    expect(globalsCss).not.toMatch(/\.kanban-column-body\s*\{[^}]*padding-bottom:/);
    expect(globalsCss).toMatch(
      /\.kanban-column-body\s*\{[\s\S]*--kanban-column-scrollbar-gutter:\s*12px;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-column-list\s*\{[\s\S]*gap:\s*10px;[\s\S]*padding:\s*6px var\(--kanban-column-scrollbar-gutter\) 0 6px;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-column-list\.kanban-bottom-clearance\s*\{[\s\S]*--kanban-bottom-clearance-height:\s*calc\([\s\S]*var\(--kanban-action-island-clearance\)[\s\S]*\);/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-bottom-gradient\s*\{[\s\S]*height:\s*var\(--kanban-bottom-fade-height\);[\s\S]*margin-top:\s*calc\(-1 \* var\(--kanban-bottom-fade-height\)\);/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-column-drop-tail\s*\{[\s\S]*min-height:\s*var\(--kanban-bottom-clearance-height,\s*1px\);/,
    );
    expect(globalsCss).not.toMatch(/\.kanban-mobile-panel-body\.kanban-bottom-clearance\s*\{/);
    expect(globalsCss).toMatch(
      /\.kanban-mobile-panel-list\s*\{[\s\S]*gap:\s*var\(--mantine-spacing-sm\);[\s\S]*padding:\s*6px 6px 0;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-panel-list\.kanban-bottom-clearance\s*\{[\s\S]*--kanban-bottom-fade-height:\s*calc\(\s*var\(--kanban-action-island-clearance\)\s*\+\s*var\(--kanban-mobile-tab-bar-height\)\s*\);[\s\S]*--kanban-bottom-clearance-height:\s*calc\(\s*var\(--kanban-action-island-clearance\)\s*\+\s*var\(--kanban-mobile-tab-bar-height\)\s*\);/,
    );
    expect(globalsCss).not.toMatch(/\.kanban-bottom-gradient--empty/);
  });

  it('removes the empty-only bottom gradient token contract', () => {
    expect(globalsCss).not.toMatch(/--kanban-empty-gradient-core:/);
    expect(globalsCss).not.toMatch(/--kanban-empty-gradient-haze:/);
    expect(globalsCss).not.toMatch(/--kanban-empty-gradient-seam:/);
  });

  it('applies a slight upward optical correction to the visible kanban status circle', () => {
    expect(globalsCss).toMatch(
      /\.kanban-status-indicator\s*\{[^}]*transform:\s*translateY\(-1px\);/,
    );
  });

  it('uses a denser mobile board shell so tabs and bottom actions take less vertical space', () => {
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tabs \.mantine-Tabs-list\s*\{[\s\S]*padding:\s*3px;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tabs \.mantine-Tabs-tab\s*\{[\s\S]*padding:\s*6px 4px;/,
    );
    expect(globalsCss).toMatch(/\.kanban-mobile-panel\s*\{[\s\S]*padding:\s*8px 6px 0;/);
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tab-copy\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/,
    );
    expect(globalsCss).toMatch(/\.kanban-mobile-tab-count\s*\{[\s\S]*min-width:\s*18px;/);
    expect(globalsCss).toMatch(
      /\.kanban-stage\s*\{[\s\S]*--kanban-action-island-clearance:\s*calc\(80px \+ env\(safe-area-inset-bottom\)\);/,
    );
    expect(globalsCss).toMatch(/\.kanban-stage\s*\{[\s\S]*--kanban-mobile-tab-bar-height:\s*0px;/);
  });

  it('anchors the action island to the board region instead of the viewport center', () => {
    expect(globalsCss).toMatch(
      /\.kanban-board-region\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*1(?: 1 auto| 1)?;[\s\S]*min-height:\s*0;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-action-island-anchor\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset-inline:\s*0;[\s\S]*bottom:\s*24px;[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*center;[\s\S]*pointer-events:\s*none;/,
    );
    expect(globalsCss).toMatch(/\.kanban-action-island\s*\{[\s\S]*pointer-events:\s*auto;/);
    expect(globalsCss).not.toMatch(/\.kanban-action-island\s*\{[\s\S]*position:\s*fixed;/);
    expect(globalsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanban-action-island-anchor\s*\{[\s\S]*bottom:\s*calc\(12px \+ var\(--kanban-mobile-tab-bar-height\)\);/,
    );
  });

  it('uses a bottom mobile tab bar shell and folds that height into the mobile clearance contract', () => {
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tab-bar\s*\{[\s\S]*flex:\s*0 0 auto;[\s\S]*padding:\s*8px 6px 0;[\s\S]*padding-bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom\)\);/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-panel-list\.kanban-bottom-clearance\s*\{[\s\S]*--kanban-bottom-fade-height:\s*calc\(\s*var\(--kanban-action-island-clearance\)\s*\+\s*var\(--kanban-mobile-tab-bar-height\)\s*\);[\s\S]*--kanban-bottom-clearance-height:\s*calc\(\s*var\(--kanban-action-island-clearance\)\s*\+\s*var\(--kanban-mobile-tab-bar-height\)\s*\);/,
    );
    expect(globalsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanban-stage\s*\{[\s\S]*--kanban-mobile-tab-bar-height:\s*calc\(64px \+ env\(safe-area-inset-bottom\)\);/,
    );
  });

  it('stacks mobile tab labels over their count pills with centered alignment', () => {
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tabs \.mantine-Tabs-tabLabel\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*center;[\s\S]*width:\s*100%;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tab-shell\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-mobile-tab-copy\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/,
    );
    expect(globalsCss).toMatch(/\.kanban-mobile-tab-label\s*\{[\s\S]*text-align:\s*center;/);
    expect(globalsCss).toMatch(/\.kanban-mobile-tab-count\s*\{[\s\S]*align-self:\s*center;/);
  });
});
