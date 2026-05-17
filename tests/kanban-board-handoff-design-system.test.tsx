// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';
import { KanbanCardContent } from '@/app/components/kanban-card';
import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

const BASE_TASK: KanbanTask = {
  id: 'task-1',
  taskKey: 'PROJ-211',
  title: 'Label color update',
  note: null,
  status: 'todo',
  sortOrder: 'a0',
  taskPriority: 'none',
  dueAt: null,
  engine: null,
  runState: null,
  runStateUpdatedAt: null,
  project: null,
  updatedAt: new Date('2026-03-10T12:00:00.000Z').toISOString(),
  archivedAt: null,
  labels: [],
};

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

describe('kanban board HTML handoff design system', () => {
  it('renders mobile board lanes with the paper panel and empty-state hooks', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={emptyColumns()}
          activeTab="todo"
          onTabChange={() => {}}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn(), refresh: vi.fn() } as any}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          saveError={null}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('kanban-mobile-panel');
    expect(html).toContain('kanban-mobile-panel-body');
    expect(html).toContain('kanban-empty-state--compact');
  });

  it('renders task cards with badge-driven metadata hooks', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{
            ...BASE_TASK,
            taskPriority: 'high',
            runState: 'queued',
            dueAt: '2026-03-12T15:45:00.000Z',
            engine: 'codex',
            note: ['- [x] Set up card lane', '- [ ] Verify mobile density'].join('\n'),
            labels: [
              { id: 'label-bug', name: 'Bugfix', color: 'red' },
              { id: 'label-frontend', name: 'Frontend', color: '#228be6' },
            ],
          }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-footer-band="true"');
    expect(html).toContain('data-kanban-footer-group="primary"');
    expect(html).toContain('data-kanban-footer-group="secondary"');
    expect(html).toContain('data-run-state-chip="queued"');
    expect(html).toContain('data-kanban-chip="due"');
    expect(html).toContain('data-kanban-chip="engine"');
    expect(html).toContain('data-kanban-chip="checklist"');
    expect(html).toContain('data-kanban-label="primary"');
    expect(html).not.toContain('data-kanban-chip="priority"');
  });
});
