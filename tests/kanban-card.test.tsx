// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider, Menu } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

declare module 'vitest' {
  interface Assertion<T> {
    toHaveClass(expectedClass: string): T;
  }
}

expect.extend({
  toHaveClass(received: Element, expectedClass: string) {
    const pass = received.classList.contains(expectedClass);

    return {
      pass,
      message: () =>
        `expected element ${pass ? 'not ' : ''}to have class "${expectedClass}", received "${received.className}"`,
    };
  },
});

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();
  const ActualMenuItem = actual.Menu.Item;
  type MockMenuItemProps = React.ComponentProps<typeof actual.Menu.Item> & {
    closeMenuOnClick?: boolean;
  };
  const MenuItem = ({ closeMenuOnClick, ...props }: MockMenuItemProps) => (
    <ActualMenuItem
      {...props}
      closeMenuOnClick={closeMenuOnClick}
      data-menu-close-on-click={closeMenuOnClick === undefined ? '' : String(closeMenuOnClick)}
    />
  );

  return {
    ...actual,
    Menu: Object.assign(actual.Menu, { Item: MenuItem }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

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

import cardStyles from '@/app/components/cards.module.css';
import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';
import {
  buildKanbanCardTelegramDispatch,
  getRunStateWaveConfig,
  isStaleQueuedTask,
  KanbanCardContent,
  KanbanCardMenuDropdown,
  renderTelegramDispatchTarget,
  resolveKanbanCardMenuPosition,
  resolveLabelHashStyle,
  resolveRunStateFrameStyle,
} from '@/app/components/kanban-card';
import { KanbanColumn } from '@/app/components/kanban-column';
import type { KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';

const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);
const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const kanbanStatusButtonRule = globalsCss.match(/\.kanban-status-button\s*\{[\s\S]*?\}/)?.[0] ?? '';

const MIN_WAVE_TOP_HEADROOM = {
  queued: 4,
  running: 8,
} as const;

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
  labels: [
    { id: 'label-bug', name: 'Bug', color: 'red' },
    { id: 'label-frontend', name: 'Frontend', color: '#228be6' },
  ],
};

function getCssRuleBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? '';
}

function getCssBlockBody(source: string, prelude: string) {
  const start = source.indexOf(prelude);
  if (start === -1) return '';

  const openBrace = source.indexOf('{', start);
  if (openBrace === -1) return '';

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }

  return '';
}

function resolveWaveTopHeadroom(runState: 'queued' | 'running') {
  const { paths, waveHeight, waveShiftPercent, bandTopClearance } = getRunStateWaveConfig(runState);
  const highestCrest = Math.min(
    ...paths.flatMap((path) => {
      const points = path.match(/-?\d+(?:\.\d+)?/g) ?? [];
      return points.filter((_, index) => index % 2 === 1).map(Number);
    }),
  );

  return highestCrest + waveHeight * (waveShiftPercent / 100) + bandTopClearance;
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

function renderQueuedTaskSurfaces(task: KanbanTask) {
  const mobileHtml = renderToStaticMarkup(
    <MantineProvider>
      <KanbanBoardMobile
        columns={{
          ...emptyColumns(),
          todo: [task],
        }}
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

  const desktopHtml = renderToStaticMarkup(
    <MantineProvider>
      <KanbanColumn
        status="todo"
        tasks={[task]}
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

  return { desktopHtml, mobileHtml };
}

function getCardForTitle(title: string) {
  const card = screen.getByText(title).closest('[role="link"]');
  expect(card).not.toBeNull();

  return card as HTMLElement;
}

describe('app/components/kanban-card', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses card-size-aware wave positioning for queued while keeping running anchored', () => {
    expect(resolveRunStateFrameStyle('queued')).toEqual({
      '--wave-band-top': 'clamp(56px, 44%, 80px)',
    });
    expect(resolveRunStateFrameStyle('running')).toEqual({
      '--wave-band-top': '80px',
      '--wave-band-top-clearance': '26px',
    });
    expect(resolveRunStateFrameStyle(null)).toBeUndefined();
  });

  it('colors only the label hash while leaving the label text on the default card text color', () => {
    expect(resolveLabelHashStyle('#228be6')).toEqual({
      color: '#228be6',
    });
  });

  it('marks only queued tasks at least one hour old as stale', () => {
    const now = Date.parse('2026-05-04T14:00:00.000Z');

    expect(isStaleQueuedTask('queued', '2026-05-04T13:00:01.000Z', now)).toBe(false);
    expect(isStaleQueuedTask('queued', '2026-05-04T13:00:00.000Z', now)).toBe(true);
    expect(isStaleQueuedTask('running', '2026-05-04T12:00:00.000Z', now)).toBe(false);
    expect(isStaleQueuedTask('queued', null, now)).toBe(false);
    expect(isStaleQueuedTask('queued', 'not-a-date', now)).toBe(false);
  });

  it('prefers opening the kanban card menu to the right when the viewport has room', () => {
    expect(
      resolveKanbanCardMenuPosition({
        triggerLeft: 780,
        viewportWidth: 1280,
      }),
    ).toBe('bottom-start');
  });

  it('falls back to opening the kanban card menu to the left near the viewport edge', () => {
    expect(
      resolveKanbanCardMenuPosition({
        triggerLeft: 1180,
        viewportWidth: 1280,
      }),
    ).toBe('bottom-end');
  });

  it('keeps visible top headroom above the wave crest for queued and running states', () => {
    expect(resolveWaveTopHeadroom('queued')).toBeGreaterThanOrEqual(MIN_WAVE_TOP_HEADROOM.queued);
    expect(resolveWaveTopHeadroom('running')).toBeGreaterThanOrEqual(MIN_WAVE_TOP_HEADROOM.running);
  });

  it('limits run-state motion to two transform-driven wave layers', () => {
    expect(getRunStateWaveConfig('queued').paths).toHaveLength(2);
    expect(getRunStateWaveConfig('running').paths).toHaveLength(2);
    expect(cardsCss).not.toContain('kanbanWaveTintFlow');
    expect(cardsCss).toMatch(/\.kanbanRunWaveLayer1\s*\{[\s\S]*animation:\s*kanbanWaveLoop/);
    expect(cardsCss).toMatch(/\.kanbanRunWaveLayer2\s*\{[\s\S]*animation:\s*kanbanWaveLoop/);
  });

  it('disables focused card pulse animation for reduced motion', () => {
    expect(cardsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.kanbanCard\.isFocused\s*\{[\s\S]*animation:\s*none;/,
    );
  });

  it('keeps focused card shadows valid when resting card elevation is disabled', () => {
    const focusedRule = getCssBlockBody(cardsCss, '.kanbanCard.isFocused');
    const focusPulseKeyframes = getCssBlockBody(cardsCss, '@keyframes kanbanCardFocusPulse');

    expect(focusedRule).toContain('box-shadow:');
    expect(focusPulseKeyframes).toContain('box-shadow:');
    expect(focusedRule).not.toContain('var(--kanban-card-shadow-rest)');
    expect(focusPulseKeyframes).not.toContain('var(--kanban-card-shadow-rest)');
  });

  it('keeps the wave band geometry tied to top-clearance variables', () => {
    expect(cardsCss).toMatch(
      /\.kanbanRunWaveBand\s*\{[\s\S]*top:\s*calc\(var\(--wave-band-top\)\s*-\s*var\(--wave-band-top-clearance\)\);[\s\S]*height:\s*calc\(var\(--wave-height\)\s*\+\s*var\(--wave-band-top-clearance\)\);/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanRunWave\s*\{[\s\S]*transform:\s*translate3d\(0,\s*calc\(var\(--wave-band-top-clearance\)\s*\+\s*var\(--wave-shift-y\)\),\s*0\);/,
    );
    expect(cardsCss).toMatch(
      /@keyframes kanbanWaveLoop\s*\{[\s\S]*0%\s*\{[\s\S]*transform:\s*translate3d\([\s\S]*calc\(var\(--wave-band-top-clearance\)\s*\+\s*var\(--wave-shift-y\)\)[\s\S]*100%\s*\{[\s\S]*transform:\s*translate3d\([\s\S]*-50%[\s\S]*calc\(var\(--wave-band-top-clearance\)\s*\+\s*var\(--wave-shift-y\)\)/,
    );
  });

  it('keeps a focus-ring rendering path for keyboard-focusable paper cards', () => {
    const style = document.createElement('style');
    style.textContent = cardsCss;
    document.head.append(style);

    const card = document.createElement('article');
    card.className = 'itemCard kanbanCard';
    document.body.append(card);

    expect(getComputedStyle(card).boxShadow.trim()).toBe('var(--kanban-card-focus-ring)');

    card.setAttribute('data-run-state', 'queued');
    expect(getComputedStyle(card).boxShadow.trim()).toBe('var(--kanban-card-focus-ring)');

    card.setAttribute('data-run-state', 'running');
    expect(getComputedStyle(card).boxShadow.trim()).toBe('var(--kanban-card-focus-ring)');

    card.remove();
    style.remove();
  });

  it('renders board cards with paper card classes and keyboard focusability', () => {
    render(
      <MantineProvider>
        <KanbanColumn
          status="todo"
          tasks={[BASE_TASK]}
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

    const card = getCardForTitle('Label color update');
    expect(card).toHaveClass(cardStyles.itemCard);
    expect(card).toHaveClass(cardStyles.kanbanCard);
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card).not.toHaveClass(cardStyles.isFocused);
  });

  it('renders unread update cards with the debug attribute and hidden status text', () => {
    const { desktopHtml } = renderQueuedTaskSurfaces({
      ...BASE_TASK,
      hasUnreadNotification: true,
    });

    expect(desktopHtml).not.toContain('kanbanCardUpdated');
    expect(desktopHtml).toContain('data-has-unread-notification="true"');
    expect(desktopHtml).toContain('kanbanCardUnreadStatus');
    expect(desktopHtml).toContain('Unread update');
    expect(desktopHtml).not.toContain('aria-label="Open task');
  });

  it('renders stale queued desktop and mobile cards with the warning badge and stale data hook', () => {
    const staleTask: KanbanTask = {
      ...BASE_TASK,
      runState: 'queued',
      runStateUpdatedAt: '2020-01-01T00:00:00.000Z',
    };

    const { desktopHtml, mobileHtml } = renderQueuedTaskSurfaces(staleTask);

    for (const html of [desktopHtml, mobileHtml]) {
      expect(html).not.toContain('kanbanCardHold');
      expect(html).toContain('data-run-state-stale="queued"');
      expect(html).toMatch(
        /data-kanban-queued-warning="true"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-kanban-queued-warning="true"/,
      );
      expect(html).toContain('Queued for more than 1 hour. Mark as done');
    }
  });

  it('dims non-target desktop cards during a focused task highlight', () => {
    const tasks = [
      { ...BASE_TASK, id: 'task-1', taskKey: 'PROJ-1', title: 'Neighbor card' },
      { ...BASE_TASK, id: 'task-2', taskKey: 'PROJ-2', title: 'Focused card' },
    ];
    render(
      <MantineProvider>
        <KanbanColumn
          status="todo"
          tasks={tasks}
          isPending={false}
          isMobile={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: () => {} } as any}
          onQuickMoveTask={() => {}}
          onDeleteTask={() => {}}
          enginePresets={null}
          focusedTaskKey="PROJ-2"
          dimmedFocusTaskKey="PROJ-2"
        />
      </MantineProvider>,
    );

    expect(getCardForTitle('Neighbor card')).toHaveClass(cardStyles.isFocusDimmed);
    expect(getCardForTitle('Focused card')).not.toHaveClass(cardStyles.isFocusDimmed);
  });

  it('dims non-target mobile cards during a focused task highlight', () => {
    const tasks = [
      { ...BASE_TASK, id: 'task-1', taskKey: 'PROJ-1', title: 'Neighbor card' },
      { ...BASE_TASK, id: 'task-2', taskKey: 'PROJ-2', title: 'Focused card' },
    ];
    render(
      <MantineProvider>
        <KanbanBoardMobile
          columns={{
            ...emptyColumns(),
            todo: tasks,
          }}
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
          focusedTaskKey="PROJ-2"
          dimmedFocusTaskKey="PROJ-2"
        />
      </MantineProvider>,
    );

    expect(getCardForTitle('Neighbor card')).toHaveClass(cardStyles.isFocusDimmed);
    expect(getCardForTitle('Focused card')).not.toHaveClass(cardStyles.isFocusDimmed);
  });

  it('renders empty columns as quiet bordered paper panels', () => {
    const emptyStateRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact');
    const emptyStateAuroraRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact::before');
    const emptyStateSeamRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact::after');

    expect(emptyStateRule).toContain('background: var(--kanban-board-bg);');
    expect(emptyStateRule).toContain('flex-direction: column;');
    expect(emptyStateRule).toContain('justify-content: flex-start;');
    expect(emptyStateRule).toContain('border: 1px dashed var(--kanban-board-border);');
    expect(emptyStateRule).toContain('border-radius: 6px;');

    expect(emptyStateAuroraRule).toContain('content: none;');
    expect(emptyStateSeamRule).toContain('content: none;');
  });

  it('keeps footer metadata as a natural continuation instead of a separated band', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardBody\s*\{[\s\S]*gap:\s*0;[\s\S]*padding:\s*12px var\(--kanban-card-inline-padding\) var\(--kanban-card-bottom-padding\);/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardHead\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*6px;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardTopRow\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*8px;/,
    );
    expect(cardsCss).toMatch(/\.kanbanCardMenuSlot\s*\{[\s\S]*margin-left:\s*auto;/);
    expect(cardsCss).toMatch(/\.kanbanMetaStack\s*\{[\s\S]*gap:\s*5px;[\s\S]*padding-top:\s*5px;/);
    expect(cardsCss).toMatch(
      /\.kanbanFooterBand\s*\{[\s\S]*margin:\s*0;[\s\S]*padding:\s*0;[\s\S]*border-top:\s*0;[\s\S]*background:\s*transparent;/,
    );
  });

  it('keeps the done control opted into the centered top-row alignment contract', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardTopRow\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*8px;/,
    );
    expect(kanbanStatusButtonRule).toContain('align-self: center;');
    expect(kanbanStatusButtonRule).not.toContain('align-self: flex-start;');
  });

  it('locks the smaller desktop and mobile kanban card density without shrinking hit targets', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardBody\s*\{[\s\S]*--kanban-card-inline-padding:\s*14px;[\s\S]*--kanban-card-bottom-padding:\s*12px;[\s\S]*padding:\s*12px var\(--kanban-card-inline-padding\) var\(--kanban-card-bottom-padding\);/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardTitle\s*\{[\s\S]*font-size:\s*1rem;[\s\S]*line-height:\s*1\.2;/,
    );
    expect(cardsCss).toMatch(/\.kanbanCardKey\s*\{[\s\S]*font-size:\s*0\.78rem;/);
    expect(cardsCss).toMatch(
      /\.kanbanMetaChip\s*\{[\s\S]*gap:\s*5px;[\s\S]*min-height:\s*24px;[\s\S]*padding:\s*0 8px;[\s\S]*font-size:\s*0\.75rem;/,
    );
    expect(cardsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanbanCardBody\s*\{[\s\S]*--kanban-card-inline-padding:\s*12px;[\s\S]*--kanban-card-bottom-padding:\s*11px;[\s\S]*padding:\s*11px 12px 11px 12px;/,
    );
    expect(cardsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanbanCardTitle\s*\{[\s\S]*font-size:\s*0\.94rem;/,
    );
    expect(cardsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanbanCardKey\s*\{[\s\S]*font-size:\s*0\.76rem;/,
    );
    expect(cardsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanbanMetaStack\s*\{[\s\S]*gap:\s*6px;/,
    );
    expect(cardsCss).toMatch(
      /@media \(max-width: 48em\)\s*\{[\s\S]*\.kanbanMetaChip\s*\{[\s\S]*min-height:\s*24px;[\s\S]*padding:\s*0 8px;[\s\S]*font-size:\s*0\.64rem;/,
    );
    expect(globalsCss).toMatch(
      /\.kanban-status-button\s*\{[\s\S]*min-width:\s*var\(--ui-hit-min\);[\s\S]*min-height:\s*var\(--ui-hit-min\);/,
    );
  });

  it('renders queued card chrome with run-state chip and decorative backdrop', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, runState: 'queued' }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-run-state="queued"');
    expect(html).toContain('data-run-state-chip="queued"');
    expect(html).toContain('Queued');
    expect(html).toContain('data-run-state-decor="queued"');
  });

  it('renders stale queued cards with warning status affordance while keeping queued chrome', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{
            ...BASE_TASK,
            runState: 'queued',
            runStateUpdatedAt: '2020-01-01T00:00:00.000Z',
          }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-run-state-stale="queued"');
    expect(html).toContain('data-run-state-chip="queued"');
    expect(html).toContain('Queued for more than 1 hour');
    expect(html).toContain('aria-label="Queued for more than 1 hour');
    expect(html).toContain('data-kanban-queued-warning="true"');
  });

  it('renders running card chrome with run-state chip and decorative backdrop', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, runState: 'running' }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-run-state="running"');
    expect(html).toContain('data-run-state-chip="running"');
    expect(html).toContain('Working');
    expect(html).toContain('data-run-state-decor="running"');
  });

  it('does not render decorative run-state chrome when runState is null', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).not.toContain('data-run-state-decor=');
    expect(html).not.toContain('data-run-state-chip=');
  });

  it('renders a title-free status action label for incomplete cards', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('aria-label="Mark as done"');
    expect(html).not.toContain('aria-label="Mark Label color update as done"');
  });

  it('renders a title-free status action label for done cards', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, status: 'done' }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('aria-label="Already done"');
    expect(html).not.toContain('aria-label="Label color update is already done"');
  });

  it('renders a unified top row before a full-width title row', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-top-row="true"');
    expect(html).toContain('data-kanban-task-copy="true"');
    expect(html).toContain('data-kanban-key-row="true"');
    expect(html).toMatch(
      /data-kanban-top-row="true"[\s\S]*PROJ-211[\s\S]*data-kanban-task-copy="true"[\s\S]*Label color update/,
    );
  });

  it('renders the priority icon after the task key instead of in the footer metadata', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, taskPriority: 'high' }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-title-priority="true"');
    expect(html).toContain('aria-label="High"');
    expect(html).toContain('data-kanban-key-row="true"');
    expect(html).toMatch(
      /data-kanban-top-row="true"[\s\S]*data-kanban-key-row="true"[\s\S]*PROJ-211[\s\S]*data-kanban-title-priority="true"[\s\S]*data-kanban-task-copy="true"[\s\S]*Label color update/,
    );
    expect(html).not.toContain('data-kanban-chip="priority"');
  });

  it('renders the first label in the footer as hash-prefixed text and moves labels to the right side', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-footer-band="true"');
    expect(html).toContain('data-kanban-footer-group="secondary"');
    expect(html).toContain('data-kanban-label="primary"');
    expect(html).toContain('#</span><span class="');
    expect(html).toContain('>Bug</span>');
    expect(html).toContain('data-kanban-label-summary="true"');
    expect(html).toContain('>+1</span>');
    expect(html).toContain('title="# Frontend"');
    expect(html).not.toContain('data-kanban-lane="labels"');
    expect(html).not.toContain('data-kanban-chip="label"');
  });

  it('renders footer metadata before the right-aligned label summary and exposes hidden labels on +N', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{
            ...BASE_TASK,
            runState: 'queued',
            taskPriority: 'high',
            engine: 'codex',
            dueAt: '2026-03-12T15:45:00.000Z',
            note: ['- [x] Set up card lane', '- [ ] Verify mobile density'].join('\n'),
            labels: [
              { id: 'label-bug', name: 'Bugfix', color: 'red' },
              { id: 'label-frontend', name: 'Frontend', color: '#228be6' },
              { id: 'label-ui', name: 'UI', color: '#4dabf7' },
              { id: 'label-accessibility', name: 'Accessibility', color: '#74c0fc' },
              { id: 'label-review', name: 'Review Needed', color: '#91a7ff' },
              { id: 'label-responsive', name: 'Responsive', color: '#5c7cfa' },
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
    expect(html).toContain('data-kanban-title-priority="true"');
    expect(html).toContain('data-kanban-key-row="true"');
    expect(html).toContain('data-kanban-label="primary"');
    expect(html).toContain('>Bugfix</span>');
    expect(html).toContain('data-kanban-label-summary="true"');
    expect(html).toContain('>+5</span>');
    expect(
      html.includes('title="# Frontend, # UI, # Accessibility, # Review Needed, # Responsive"'),
    ).toBe(true);
    expect(html).toContain('data-run-state-chip="queued"');
    expect(html).toContain('Due 2026-03-12');
    expect(html).toContain('data-kanban-chip="engine"');
    expect(html).toContain('data-kanban-chip="checklist"');
    expect(html).toContain('data-kanban-checklist-icon="true"');
    expect(html).toMatch(
      /data-kanban-top-row="true"[\s\S]*data-kanban-key-row="true"[\s\S]*PROJ-211[\s\S]*data-kanban-title-priority="true"[\s\S]*data-kanban-task-copy="true"[\s\S]*Label color update[\s\S]*data-kanban-footer-group="primary"[\s\S]*Queued[\s\S]*Due 2026-03-12[\s\S]*Codex CLI[\s\S]*1\/2[\s\S]*data-kanban-footer-group="secondary"[\s\S]*Bugfix[\s\S]*\+5/,
    );
    expect(html).not.toContain('data-kanban-chip="priority"');
    expect(html).not.toContain('Review Needed</span>');
    expect(html).not.toContain('Responsive</span>');
  });

  it('omits the footer band when there is neither footer metadata nor any labels', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, labels: [] }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
        />
      </MantineProvider>,
    );

    expect(html).not.toContain('data-kanban-footer-band="true"');
    expect(html).not.toContain('_kanbanMetaStack_');
  });

  it('renders a hover-ready empty label shortcut when inline label editing is enabled', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={{ ...BASE_TASK, labels: [] }}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
          labelOptions={[{ id: 'label-bug', name: 'Bug', color: 'red' }]}
          onUpdateTaskLabels={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-footer-band="true"');
    expect(html).toContain('data-kanban-label-shortcut="empty"');
    expect(html).toContain('aria-label="Edit labels for Label color update"');
    expect(html).toContain('>#</span>');
  });

  it('keeps the card label shortcut shell compact instead of stretching like a form control', () => {
    expect(cardsCss).toMatch(
      /\.kanbanLabelShortcutButton\s*\{[\s\S]*max-width:\s*100%;[\s\S]*padding:\s*2px 6px;[\s\S]*background:\s*transparent;[\s\S]*transition:[\s\S]*opacity 140ms ease,[\s\S]*background-color 140ms ease,[\s\S]*box-shadow 140ms ease;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanLabelShortcutButton\[data-kanban-label-shortcut='empty'\]\s*\{[\s\S]*width:\s*1\.75rem;[\s\S]*height:\s*1\.75rem;/,
    );
    expect(cardsCss).not.toMatch(
      /\.kanbanLabelShortcutButton\[data-kanban-label-shortcut='empty'\]\s*\{[^}]*transition:/,
    );
    expect(cardsCss).toMatch(/\.kanbanLabelShortcutSurface\s*\{[\s\S]*gap:\s*4px;/);
  });

  it('keeps the card menu trigger hidden until hover on pointer devices while leaving it visible for focus and touch', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardMenuTrigger\s*\{[\s\S]*opacity:\s*0;[\s\S]*transition:[\s\S]*opacity 140ms ease/,
    );
    expect(cardsCss).toMatch(
      /\.itemCard\.kanbanCard:hover \.kanbanCardMenuTrigger,\s*\.itemCard\.kanbanCard:focus-within \.kanbanCardMenuTrigger\s*\{[\s\S]*opacity:\s*1;/,
    );
    expect(cardsCss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*\.kanbanCardMenuTrigger\s*\{[\s\S]*opacity:\s*1;/,
    );
  });

  it('turns the footer label cluster into the editable shortcut when labels already exist', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardContent
          task={BASE_TASK}
          isPending={false}
          editHref="/board?panel=task-edit&taskId=PROJ-211"
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          enginePresets={null}
          labelOptions={[
            { id: 'label-bug', name: 'Bug', color: 'red' },
            { id: 'label-frontend', name: 'Frontend', color: '#228be6' },
          ]}
          onUpdateTaskLabels={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-kanban-label-shortcut="labels"');
    expect(html).toContain('data-kanban-label="primary"');
    expect(html).toContain('data-kanban-label-summary="true"');
    expect(html).toContain('aria-label="Edit labels for Label color update"');
  });

  it('renders task and telegram card actions while removing the project shortcut', () => {
    const dropdownProps = {
      task: {
        ...BASE_TASK,
        branch: 'task/proj-211/label-color-update',
        project: {
          id: 'project-1',
          name: 'Project One',
          projectKey: 'project-one',
        },
      },
      isPending: false,
      isMobile: false,
      editHref: '/board?panel=task-edit&taskId=PROJ-211',
      telegramEnabled: true,
      telegramDispatchDetail: (
        <>
          <span>Codex CLI | </span>
          {renderTelegramDispatchTarget('telegram')}
          <span> | Implement</span>
        </>
      ),
      telegramDispatchTooltipDetail: (
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
      ),
      isSendingTelegram: false,
      onQuickMoveTask: vi.fn(),
      onDeleteTask: vi.fn(),
      onCopyTaskId: vi.fn(),
      onCopyTelegramMessage: vi.fn(),
      onSendTelegramMessage: vi.fn(),
    };
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Menu opened withinPortal={false}>
          <Menu.Target>
            <button type="button">Actions</button>
          </Menu.Target>
          <KanbanCardMenuDropdown {...dropdownProps} />
        </Menu>
      </MantineProvider>,
    );

    expect(html).toContain('Copy Task ID');
    expect(html).toContain('Copy Telegram Message');
    expect(html).toContain('Send Telegram Message');
    expect(html).not.toContain('data-kanban-dispatch-detail="true"');
    expect(html).not.toContain('data-kanban-dispatch-summary="desktop"');
    expect(html).not.toContain('data-kanban-dispatch-summary-item="true"');
    expect(html).not.toContain('/icons/hermes-agent.png');
    expect(html).not.toContain('task-dispatch-target-option');
    expect(html).not.toContain('task-dispatch-target-emoji');
    expect(html).toContain('Move to Planned');
    expect(html).not.toContain('Move to Todo');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
    expect(html).not.toContain('Open Project');
  });

  it('keeps the mobile telegram summary inline beneath the send action with the current target visible', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <Menu opened withinPortal={false}>
          <Menu.Target>
            <button type="button">Actions</button>
          </Menu.Target>
          <KanbanCardMenuDropdown
            task={BASE_TASK}
            isPending={false}
            isMobile
            editHref="/board?panel=task-edit&taskId=PROJ-211"
            telegramEnabled
            telegramDispatchDetail={
              <>
                <span>Codex CLI | </span>
                {renderTelegramDispatchTarget('hermes-telegram')}
                <span> | Implement</span>
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

    expect(html).toContain('data-kanban-dispatch-detail="true"');
    expect(html).toContain('data-menu-close-on-click="false"');
    expect(html).not.toContain('data-kanban-dispatch-summary="desktop"');
    expect(html).toContain('/icons/hermes-agent.png');
    expect(html).toContain('Telegram');
    expect(html).toContain('Codex CLI | ');
    expect(html).toContain('| Implement');
    expect(html).not.toContain('Mode: Implement');
  });

  it('renders the Hermes telegram target detail with the shared icon styling', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>{renderTelegramDispatchTarget('hermes-telegram')}</MantineProvider>,
    );

    expect(html).toContain('/icons/hermes-agent.png');
    expect(html).toContain('Telegram');
    expect(html).not.toContain('task-dispatch-target-option');
    expect(html).not.toContain('task-dispatch-target-logo');
    expect(html).not.toContain('task-dispatch-target-emoji');
    expect(cardsCss).toMatch(
      /\.kanbanDispatchTargetLogo\s*\{[\s\S]*width:\s*1rem;[\s\S]*height:\s*1rem;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardMenuDispatchDetail\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardMenuDispatchTooltipDetail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardMenuDispatchTooltipRow\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/,
    );
    expect(cardsCss).toMatch(/\.kanbanCardMenuDispatchTooltip\s*\{[\s\S]*max-width:\s*16rem;/);
  });

  it('builds Hermes card dispatches with the Hermes message payload and target', () => {
    const dispatch = buildKanbanCardTelegramDispatch({
      task: {
        ...BASE_TASK,
        branch: 'task/proj-211/label-color-update',
        dispatchTarget: 'hermes-telegram',
      },
      displayEngine: 'codex',
    });

    expect(dispatch.dispatchTarget).toBe('hermes-telegram');
    expect(dispatch.message).toContain('/preqstation_dispatch@PreqHermesBot');
    expect(dispatch.message).toContain('task_key=PROJ-211');
    expect(dispatch.message).toContain('engine=codex');
    expect(dispatch.message).toContain('branch_name=task/proj-211/label-color-update');
    expect(dispatch.message).not.toContain('!/skill preqstation-dispatch');
  });
});
