// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { KanbanCardContent } from '@/app/components/kanban-card';
import type { KanbanTask } from '@/lib/kanban-helpers';

const BASE_TASK: KanbanTask = {
  id: 'task-1',
  taskKey: 'PROJ-211',
  title: 'Runtime bridge',
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

function renderCard(task: KanbanTask) {
  return renderToStaticMarkup(
    <MantineProvider>
      <KanbanCardContent
        task={task}
        isPending={false}
        editHref="/board?panel=task-edit&taskId=PROJ-211"
        onQuickMoveTask={vi.fn()}
        onDeleteTask={vi.fn()}
        enginePresets={null}
      />
    </MantineProvider>,
  );
}

describe('KanbanCardContent work graph badge', () => {
  it('renders the highest-priority graph summary badge in the footer', () => {
    const html = renderCard({
      ...BASE_TASK,
      workGraphSummary: {
        running_count: 1,
        ready_count: 0,
        waiting_count: 0,
        blocked_count: 1,
        failed_count: 0,
        completed_count: 2,
        root_overlay: 'blocked',
      },
    });

    expect(html).toContain('data-kanban-chip="work-graph"');
    expect(html).toContain('data-work-graph-state="blocked"');
    expect(html).toContain('Graph blocked');
    expect(html).toContain('1 blocked');
  });

  it('preserves offline card output when graph summary is absent', () => {
    const html = renderCard(BASE_TASK);

    expect(html).not.toContain('data-kanban-chip="work-graph"');
    expect(html).not.toContain('Work Tree');
  });
});
