import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tooltipPropsMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: ({
      children,
      classNames,
      color,
      events,
      label,
      openDelay,
      styles,
    }: {
      children?: React.ReactNode;
      classNames?: { tooltip?: string };
      color?: string;
      events?: { focus?: boolean; hover?: boolean; touch?: boolean };
      label?: React.ReactNode;
      openDelay?: number;
      styles?: {
        tooltip?: React.CSSProperties;
        arrow?: React.CSSProperties;
      };
    }) => {
      tooltipPropsMock({ classNames, color, events, label, openDelay, styles });

      return (
        <div
          data-tooltip-class={classNames?.tooltip ?? ''}
          data-tooltip-color={color ?? ''}
          data-tooltip-events-focus={String(events?.focus ?? '')}
          data-tooltip-events-hover={String(events?.hover ?? '')}
          data-tooltip-events-touch={String(events?.touch ?? '')}
          data-tooltip-open-delay={String(openDelay ?? '')}
          data-tooltip-style-bg={styles?.tooltip?.background ?? ''}
          data-tooltip-style-color={styles?.tooltip?.color ?? ''}
        >
          {children}
          <div data-tooltip-label>{label}</div>
        </div>
      );
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { KanbanCardContent } from '@/app/components/kanban-card';
import type { KanbanTask } from '@/lib/kanban-helpers';

const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);

const BASE_TASK: KanbanTask = {
  id: 'task-1',
  taskKey: 'PROJ-323',
  title: 'kanban card tag hover tooltip issue',
  note: null,
  status: 'todo',
  sortOrder: 'a0',
  taskPriority: 'none',
  dueAt: null,
  engine: null,
  runState: null,
  runStateUpdatedAt: null,
  project: null,
  updatedAt: new Date('2026-04-07T12:00:00.000Z').toISOString(),
  archivedAt: null,
  labels: [
    { id: 'label-bug', name: 'Bug', color: 'red' },
    { id: 'label-ui', name: 'UI', color: '#228be6' },
    { id: 'label-manual', name: 'Manual', color: '#fab005' },
  ],
};

describe('app/components/kanban-card label tooltip behavior', () => {
  beforeEach(() => {
    tooltipPropsMock.mockClear();
  });

  it('wraps the actionable done control in a hover and focus tooltip using the action copy', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, labels: [] }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-323"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Mark as done');
    expect(html).toContain('data-tooltip-events-hover="true"');
    expect(html).toContain('data-tooltip-events-focus="true"');
    expect(html).toContain('data-tooltip-events-touch="false"');
    expect(tooltipPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        events: { hover: true, focus: true, touch: false },
        label: 'Mark as done',
      }),
    );
  });

  it('shows the already-done explanation from the same tooltip copy path', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, labels: [], status: 'done' }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-323"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Already done');
    expect(tooltipPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Already done',
      }),
    );
  });

  it('shows the visible primary label in the same immediate tooltip treatment on hover', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, labels: [{ id: 'label-bug', name: 'Bug', color: 'red' }] }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-323"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-label="primary"');
    expect(html).toContain('data-tooltip-open-delay="0"');
    expect(html).toContain('data-tooltip-style-bg="rgba(11, 20, 38, 0.96)"');
    expect(html).toContain('data-tooltip-style-color="#f5f8ff"');
  });

  it('opens hidden-label tooltip immediately and uses the dedicated tooltip surface styling hook', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-323"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-tooltip-open-delay="0"');
    expect(html).toContain('data-tooltip-style-bg="rgba(11, 20, 38, 0.96)"');
    expect(html).toContain('data-tooltip-style-color="#f5f8ff"');
    expect(html).toContain('data-kanban-label-summary="true"');
    expect(html).toContain('>UI</span>');
    expect(html).toContain('>Manual</span>');
    expect(tooltipPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        openDelay: 0,
        styles: expect.objectContaining({
          tooltip: expect.objectContaining({
            background: 'rgba(11, 20, 38, 0.96)',
            color: '#f5f8ff',
          }),
        }),
      }),
    );
  });

  it('keeps the same tooltip styling when the footer labels become the editable shortcut', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-323"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
          labelOptions={[
            { id: 'label-bug', name: 'Bug', color: 'red' },
            { id: 'label-ui', name: 'UI', color: '#228be6' },
            { id: 'label-manual', name: 'Manual', color: '#fab005' },
          ]}
          onUpdateTaskLabels={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-label-shortcut="labels"');
    expect(html).toContain('data-tooltip-open-delay="0"');
    expect(html).toContain('data-tooltip-style-bg="rgba(11, 20, 38, 0.96)"');
    expect(html).toContain('data-tooltip-style-color="#f5f8ff"');
  });

  it('uses an arrow cursor on the summary and explicit contrast rules inside the tooltip', () => {
    expect(cardsCss).toMatch(/\.kanbanLabelSummary\s*\{[\s\S]*cursor:\s*default;/);
    expect(cardsCss).toMatch(
      /\.kanbanLabelTooltipSurface\s*\{[\s\S]*background:\s*rgba\(11,\s*20,\s*38,\s*0\.96\);[\s\S]*color:\s*#f5f8ff;/,
    );
    expect(cardsCss).toMatch(/\.kanbanLabelTooltipItem\s*\{[\s\S]*color:\s*inherit;/);
  });
});
