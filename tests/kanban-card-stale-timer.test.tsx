// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import cardStyles from '@/app/components/cards.module.css';
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

function renderCard(task: KanbanTask) {
  return render(
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

function renderMobileBoard(task: KanbanTask) {
  return render(
    <MantineProvider>
      <KanbanBoardMobile
        columns={{ ...emptyColumns(), todo: [task] }}
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
}

describe('KanbanCardContent stale queued timer', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('refreshes the stale queued affordance when the queued task crosses one hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T12:59:59.000Z'));

    const { container } = renderCard({
      ...BASE_TASK,
      runState: 'queued',
      runStateUpdatedAt: '2026-05-04T12:00:00.000Z',
    });

    expect(container.querySelector('[data-run-state-stale="queued"]')).toBeNull();
    expect(screen.queryByLabelText(/^Queued for more than 1 hour/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(container.querySelector('[data-run-state-stale="queued"]')).not.toBeNull();
    expect(screen.getByLabelText(/^Queued for more than 1 hour/)).not.toBeNull();
    expect(container.querySelector('[data-kanban-queued-warning="true"]')).not.toBeNull();
  });

  it('refreshes the mobile stale queued hold accent when the queued task crosses one hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T12:59:59.000Z'));

    renderMobileBoard({
      ...BASE_TASK,
      runState: 'queued',
      runStateUpdatedAt: '2026-05-04T12:00:00.000Z',
    });

    const card = screen.getByRole('link', { name: /Open task PROJ-211/ });
    expect(card.className).not.toContain(cardStyles.kanbanCardHold);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(card.className).toContain(cardStyles.kanbanCardHold);
  });
});
