import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider, Menu } from '@mantine/core';
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

import {
  KanbanCardContent,
  KanbanCardMenuDropdown,
  renderTelegramDispatchTarget,
} from '@/app/components/kanban-card';
import type { KanbanTask } from '@/lib/kanban-helpers';

const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);

function getLabelTooltipProps() {
  return tooltipPropsMock.mock.calls
    .map(([props]) => props)
    .filter((props) => props.classNames?.tooltip);
}

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
    expect(html).toContain('data-tooltip-style-bg="var(--ui-tooltip-surface)"');
    expect(html).toContain('data-tooltip-style-color="var(--ui-tooltip-text)"');
  });

  it('uses one read-only label tooltip containing every task label in order', () => {
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
    const labelTooltipProps = getLabelTooltipProps();
    const tooltipLabelHtml = renderToStaticMarkup(labelTooltipProps[0].label);

    expect(labelTooltipProps).toHaveLength(1);
    expect(html).toContain('data-tooltip-open-delay="0"');
    expect(html).toContain('data-tooltip-style-bg="var(--ui-tooltip-surface)"');
    expect(html).toContain('data-tooltip-style-color="var(--ui-tooltip-text)"');
    expect(html).toContain('data-kanban-label="primary"');
    expect(html).toContain('data-kanban-label-summary="true"');
    expect(html).toContain('aria-label="#Bug #UI #Manual"');
    expect(tooltipLabelHtml).toContain('>Bug</span>');
    expect(tooltipLabelHtml).toContain('>UI</span>');
    expect(tooltipLabelHtml).toContain('>Manual</span>');
    expect(tooltipLabelHtml.indexOf('>Bug</span>')).toBeLessThan(
      tooltipLabelHtml.indexOf('>UI</span>'),
    );
    expect(tooltipLabelHtml.indexOf('>UI</span>')).toBeLessThan(
      tooltipLabelHtml.indexOf('>Manual</span>'),
    );
    expect(tooltipPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        openDelay: 0,
        styles: expect.objectContaining({
          tooltip: expect.objectContaining({
            background: 'var(--ui-tooltip-surface)',
            color: 'var(--ui-tooltip-text)',
          }),
        }),
      }),
    );
  });

  it('uses one editable shortcut label tooltip containing every task label in order', () => {
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
    const labelTooltipProps = getLabelTooltipProps();
    const tooltipLabelHtml = renderToStaticMarkup(labelTooltipProps[0].label);

    expect(labelTooltipProps).toHaveLength(1);
    expect(html).toContain('data-kanban-label-shortcut="labels"');
    expect(html).toContain('data-tooltip-open-delay="0"');
    expect(html).toContain('data-tooltip-style-bg="var(--ui-tooltip-surface)"');
    expect(html).toContain('data-tooltip-style-color="var(--ui-tooltip-text)"');
    expect(html).toContain('aria-label="#Bug #UI #Manual"');
    expect(tooltipLabelHtml).toContain('>Bug</span>');
    expect(tooltipLabelHtml).toContain('>UI</span>');
    expect(tooltipLabelHtml).toContain('>Manual</span>');
    expect(tooltipLabelHtml.indexOf('>Bug</span>')).toBeLessThan(
      tooltipLabelHtml.indexOf('>UI</span>'),
    );
    expect(tooltipLabelHtml.indexOf('>UI</span>')).toBeLessThan(
      tooltipLabelHtml.indexOf('>Manual</span>'),
    );
  });

  it('shows the telegram detail as separate rows in the desktop send tooltip', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Menu opened withinPortal={false}>
          <Menu.Target>
            <button type="button">Actions</button>
          </Menu.Target>
          <KanbanCardMenuDropdown
            task={BASE_TASK}
            isPending={false}
            isMobile={false}
            editHref="/board?panel=task-edit&taskId=PROJ-323"
            telegramEnabled
            telegramDispatchDetail={
              <>
                <span>Codex CLI | </span>
                {renderTelegramDispatchTarget('telegram')}
                <span> | Implement</span>
              </>
            }
            telegramDispatchTooltipDetail={
              <>
                <div data-kanban-dispatch-tooltip-row="engine">
                  <span>Codex CLI</span>
                </div>
                <div data-kanban-dispatch-tooltip-row="target">
                  {renderTelegramDispatchTarget('telegram')}
                </div>
                <div data-kanban-dispatch-tooltip-row="mode">
                  <span>Implement</span>
                </div>
              </>
            }
            isSendingTelegram={false}
            onQuickMoveTask={vi.fn()}
            onDeleteTask={vi.fn()}
            onCopyTaskId={vi.fn()}
            onCopyTelegramMessage={vi.fn()}
            onSendTelegramMessage={vi.fn()}
          />
        </Menu>
      </MantineProvider>,
    );

    expect(html).toContain('data-tooltip-events-hover="true"');
    expect(html).toContain('data-tooltip-events-focus="true"');
    expect(html).toContain('data-tooltip-events-touch="true"');
    expect(html).toContain('data-kanban-dispatch-tooltip-row="engine"');
    expect(html).toContain('data-kanban-dispatch-tooltip-row="target"');
    expect(html).toContain('data-kanban-dispatch-tooltip-row="mode"');
    expect(html).toContain('Codex CLI');
    expect(html).toContain('🦞');
    expect(html).toContain('Telegram');
    expect(html).toContain('Implement');
    expect(html).not.toContain('Codex CLI | ');
    expect(html).not.toContain('| Implement');
    expect(html).not.toContain('Engine: Codex CLI');
    expect(html).not.toContain('Target: ');
    expect(html).not.toContain('Mode: Implement');
    expect(tooltipPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        events: { hover: true, focus: true, touch: true },
        label: expect.anything(),
      }),
    );
  });

  it('lets the summary inherit its wrapper cursor and keeps contrast rules inside the tooltip', () => {
    expect(cardsCss).toMatch(/\.kanbanLabelSummary\s*\{[\s\S]*cursor:\s*inherit;/);
    expect(cardsCss).toMatch(
      /\.kanbanLabelTooltipSurface\s*\{[\s\S]*background:\s*var\(--kanban-card-tooltip-surface\);[\s\S]*color:\s*var\(--kanban-card-tooltip-text\);/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanLabelTooltipSurface\s*\{[\s\S]*border:\s*var\(--kanban-card-tooltip-border\);/,
    );
    expect(cardsCss).toMatch(/\.kanbanLabelTooltipItem\s*\{[\s\S]*color:\s*inherit;/);
  });
});
