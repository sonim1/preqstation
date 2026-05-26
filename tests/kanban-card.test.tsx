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

function renderCardsCssFixture(
  markup: string,
  includeGlobals = false,
  colorScheme?: 'dark' | 'light',
) {
  const style = document.createElement('style');
  const fixture = document.createElement('div');
  const previousColorScheme = document.documentElement.getAttribute('data-mantine-color-scheme');

  if (colorScheme) {
    document.documentElement.setAttribute('data-mantine-color-scheme', colorScheme);
  }

  style.textContent = `${includeGlobals ? `${globalsCss}\n` : ''}${cardsCss}`;
  fixture.innerHTML = markup;
  document.head.append(style);
  document.body.append(fixture);

  return {
    fixture,
    cleanup: () => {
      fixture.remove();
      style.remove();
      if (previousColorScheme === null) {
        document.documentElement.removeAttribute('data-mantine-color-scheme');
      } else {
        document.documentElement.setAttribute('data-mantine-color-scheme', previousColorScheme);
      }
    },
  };
}

function getRequiredFixtureElement(fixture: HTMLElement, testId: string) {
  const element = fixture.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  expect(element).not.toBeNull();

  return element!;
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

  it('defines an in-bounds focus ring for kanban cards without dropping run-state shadows', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCard\s*\{[\s\S]*--kanban-card-focus-ring:\s*inset 0 0 0 0 transparent;[\s\S]*box-shadow:\s*var\(--kanban-card-focus-ring\),/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCard:focus-visible,\s*\.kanbanCard:focus-within\s*\{[\s\S]*outline:\s*none;[\s\S]*--kanban-card-focus-ring:\s*inset 0 0 0 2px/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanMetaChip\s*\{[\s\S]*background:\s*var\(--ui-surface-elevated\);/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanRunStateChip\s*\{[\s\S]*background:\s*var\(--ui-surface-elevated-strong\);/,
    );
  });

  it('defines stronger four-sided card shadows and a board-scoped stage surface', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCard\s*\{[\s\S]*--kanban-card-shadow-rest:\s*0 0 0 1px [^;]+,\s*0 18px 34px -22px [^;]+,\s*0 6px 14px -10px [^;]+,\s*0 1px 3px [^;]+;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCard\s*\{[\s\S]*--kanban-card-shadow-queued:\s*0 0 0 1px [^;]+,\s*0 20px 38px -24px [^;]+,\s*0 8px 18px -12px [^;]+,\s*0 1px 3px [^;]+;/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCard\s*\{[\s\S]*--kanban-card-shadow-running:\s*0 0 0 1px [^;]+,\s*0 22px 42px -24px [^;]+,\s*0 10px 20px -14px [^;]+,\s*0 2px 6px [^;]+;/,
    );
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      '<section class="kanban-stage" data-testid="stage"></section>',
      true,
    );

    try {
      const stageStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'stage'));

      expect(stageStyle.background).toBe('var(--kanban-stage-surface)');
    } finally {
      cleanupFixture();
    }
  });

  it('darkens the board stage with ambient tokens behind boundary-free lanes', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      '<section class="kanban-stage" data-testid="stage"></section>',
      true,
      'dark',
    );

    try {
      const stageStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'stage'));

      expect(stageStyle.position).toBe('relative');
      expect(stageStyle.isolation).toBe('isolate');
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-accent').trim()).toBe(
        'var(--ui-accent-soft)',
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-running').trim()).toBe(
        'var(--ui-status-running-soft)',
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-layer').trim()).toBe(
        'linear-gradient(124deg,transparent 8%,var(--kanban-stage-ambient-accent) 25%,transparent 43%),linear-gradient(218deg,transparent 12%,var(--kanban-stage-ambient-running) 35%,transparent 56%)',
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-z-index').trim()).toBe('-1');
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-opacity').trim()).toBe('0.22');
      expect(stageStyle.getPropertyValue('--kanban-stage-ambient-animation').trim()).toBe(
        'kanbanStageAmbientDrift 24s ease-in-out infinite alternate',
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-depth-start').trim()).toMatch(
        /^oklch\(\s*15%\s*0\.018\s+255\s*\/\s*0\.98\s*\)$/,
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-depth-mid').trim()).toMatch(
        /^oklch\(\s*18%\s*0\.02\s+255\s*\/\s*0\.94\s*\)$/,
      );
      expect(stageStyle.getPropertyValue('--kanban-stage-depth-end').trim()).toMatch(
        /^oklch\(\s*14%\s*0\.016\s+255\s*\/\s*0\.98\s*\)$/,
      );
      expect(stageStyle.getPropertyValue('--kanban-frame-stage-surface').trim()).toBe(
        'linear-gradient(160deg,var(--kanban-stage-depth-start),var(--kanban-stage-depth-mid) 48%,var(--kanban-stage-depth-end))',
      );
    } finally {
      cleanupFixture();
    }
  });

  it('keeps the dark kanban card surface opaque while softening the repeated outline', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      `
        <article class="itemCard kanbanCard" data-testid="card">
          <div class="kanbanCardFrame" data-testid="frame"></div>
        </article>
      `,
      true,
      'dark',
    );

    try {
      const cardStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'card'));
      const frameStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'frame'));
      const darkSurface = cardStyle.getPropertyValue('--kanban-card-surface').trim();

      expect(cardStyle.getPropertyValue('--kanban-note-surface').trim()).toBe(
        'var(--kanban-card-surface)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-depth-start').trim()).toBe('');
      expect(cardStyle.getPropertyValue('--kanban-card-depth-end').trim()).toBe('');
      expect(darkSurface).toBe('#17243a');
      expect(darkSurface).not.toContain('gradient');
      expect(darkSurface).not.toContain('var(');
      expect(darkSurface).not.toContain('rgba(');
      expect(cardStyle.background).toBe('var(--kanban-note-surface)');
      expect(frameStyle.background).toBe('var(--kanban-note-surface)');
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-outline-transparency').trim()).toBe(
        '52%',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-outline')).toContain(
        'transparent var(--kanban-card-shadow-outline-transparency)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-queued-outline').trim()).toBe(
        'var(--kanban-card-shadow-outline)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-running-outline').trim()).toBe(
        'var(--kanban-card-shadow-outline)',
      );
    } finally {
      cleanupFixture();
    }
  });

  it('disables stage ambient animation for reduced motion', () => {
    expect(globalsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.kanban-stage::after\s*\{[\s\S]*animation:\s*none;/,
    );
  });

  it('keeps the light kanban card surface opaque and position-independent', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      `
        <article class="itemCard kanbanCard" data-testid="card">
          <div class="kanbanCardFrame" data-testid="frame"></div>
        </article>
      `,
      true,
      'light',
    );

    try {
      const cardStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'card'));
      const lightSurface = cardStyle.getPropertyValue('--kanban-card-surface').trim();

      expect(cardStyle.getPropertyValue('--kanban-note-surface').trim()).toBe(
        'var(--kanban-card-surface)',
      );
      expect(lightSurface).toBe('#f8fbff');
      expect(lightSurface).not.toContain('gradient');
      expect(lightSurface).not.toContain('var(');
      expect(lightSurface).not.toContain('rgba(');
    } finally {
      cleanupFixture();
    }
  });

  it('derives run-state wave chrome from execution tokens and local mechanics variables', () => {
    const frameRule = getCssRuleBody(cardsCss, '.kanbanCardFrame');
    const queuedRule = getCssRuleBody(cardsCss, ".kanbanCardFrame[data-run-state='queued']");
    const runningRule = getCssRuleBody(cardsCss, ".kanbanCardFrame[data-run-state='running']");

    expect(frameRule).toContain('--kanban-run-state-color: var(--ui-status-queued);');
    expect(frameRule).toContain('--kanban-run-state-surface: var(--ui-accent-soft);');
    expect(frameRule).toContain('--wave-layer-1: color-mix(in srgb, var(--kanban-run-state-color)');
    expect(frameRule).toContain('--wave-tint-bg: linear-gradient(');

    expect(queuedRule).toContain('--kanban-run-state-color: var(--ui-status-queued);');
    expect(queuedRule).toContain('--kanban-run-state-surface: var(--ui-accent-soft);');
    expect(runningRule).toContain('--kanban-run-state-color: var(--ui-status-running);');
    expect(runningRule).toContain('--kanban-run-state-surface: var(--ui-status-running-soft);');
    expect(runningRule).toContain('--wave-filter: drop-shadow(0 0 8px');
    expect(runningRule).toContain('var(--ui-status-running-glow)');

    expect(`${frameRule}\n${queuedRule}\n${runningRule}`).not.toMatch(
      /rgba\((?:62, 106, 225|94, 133, 242|118, 150, 248|123, 151, 255|56, 189, 248|74, 204, 249|115, 244, 224|18, 184, 134|40, 196, 208)/,
    );
  });

  it('renders tokenized board lanes with subtly rounded note cards carried by shadows', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      '<div class="kanban-column" data-testid="column"></div>',
      true,
    );

    try {
      const columnStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'column'));

      expect(columnStyle.getPropertyValue('--kanban-bottom-gradient-surface').trim()).toBe(
        'transparent',
      );
      expect(columnStyle.borderTopWidth).toBe('0px');
      expect(columnStyle.borderTopStyle).toBe('none');
      expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(columnStyle.backgroundColor);
      expect(['', 'none']).toContain(columnStyle.boxShadow.trim());
      expect(columnStyle.transition).not.toContain('box-shadow');
      expect(globalsCss).toMatch(
        /\.kanban-mobile-panel\s*\{[\s\S]*--kanban-bottom-gradient-surface:\s*transparent;[\s\S]*background:\s*transparent;[\s\S]*border-radius:\s*0;/,
      );
      expect(cardsCss).toMatch(
        /\.kanbanCard\s*\{[\s\S]*--kanban-card-radius:\s*6px;[\s\S]*border:\s*0;[\s\S]*border-radius:\s*var\(--kanban-card-radius\);[\s\S]*background:\s*var\(--kanban-note-surface\);/,
      );
      expect(cardsCss).toMatch(
        /\.kanbanCardFrame\s*\{[\s\S]*border-radius:\s*var\(--kanban-card-radius\);/,
      );
      expect(cardsCss).toMatch(
        /\.itemCard\.kanbanCard\s*\{[\s\S]*border:\s*0;[\s\S]*border-radius:\s*var\(--kanban-card-radius\);[\s\S]*box-shadow:\s*var\(--kanban-card-focus-ring\),\s*var\(--kanban-card-shadow-rest\);/,
      );
      expect(cardsCss).toMatch(/\.kanbanCard::after\s*\{[\s\S]*content:\s*none;/);
    } finally {
      cleanupFixture();
    }
  });

  it('keeps card state shadows on semantic theme variables instead of raw shadow colors', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(
      '<article class="kanbanCard" data-testid="card"></article>',
      true,
    );

    try {
      const cardStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'card'));
      const shadowProperties = [
        '--kanban-card-shadow-outline',
        '--kanban-card-shadow-ambient',
        '--kanban-card-shadow-queued-glow',
        '--kanban-card-shadow-running-ambient',
      ];

      for (const property of shadowProperties) {
        const value = cardStyle.getPropertyValue(property);

        expect(value).toContain('color-mix(');
        expect(value).not.toMatch(/rgba\((?:255, 255, 255|24, 44, 84|33, 56, 97|8, 23, 40)/);
      }

      expect(cardStyle.boxShadow).toBe(
        'var(--kanban-card-focus-ring), var(--kanban-card-shadow-rest)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-rest')).toContain(
        '0 0 0 1px var(--kanban-card-shadow-outline)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-queued')).toContain(
        'var(--kanban-card-shadow-queued-glow)',
      );
      expect(cardStyle.getPropertyValue('--kanban-card-shadow-running')).toContain(
        'var(--kanban-card-shadow-running-ambient)',
      );
    } finally {
      cleanupFixture();
    }
  });

  it('keeps label, metadata, and tooltip surfaces on the card surface hierarchy', () => {
    const { fixture, cleanup: cleanupFixture } = renderCardsCssFixture(`
      <article class="kanbanCard" data-testid="card">
        <span class="kanbanMetaChip" data-testid="meta-chip"></span>
        <span class="kanbanMetaChip kanbanRunStateChip" data-testid="run-chip"></span>
      </article>
      <div class="kanbanCardMenuDispatchTooltip" data-testid="menu-tooltip"></div>
      <div class="kanbanLabelTooltipSurface" data-testid="label-tooltip"></div>
    `);

    try {
      const cardStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'card'));
      const metaChipStyle = window.getComputedStyle(
        getRequiredFixtureElement(fixture, 'meta-chip'),
      );
      const runChipStyle = window.getComputedStyle(getRequiredFixtureElement(fixture, 'run-chip'));
      const tooltipStyles = ['menu-tooltip', 'label-tooltip'].map((testId) =>
        window.getComputedStyle(getRequiredFixtureElement(fixture, testId)),
      );

      expect(cardStyle.getPropertyValue('--kanban-card-tooltip-surface')).toBe('');
      expect(cardStyle.getPropertyValue('--kanban-card-tooltip-text')).toBe('');
      expect(cardStyle.getPropertyValue('--kanban-card-tooltip-border')).toBe('');
      expect(metaChipStyle.background).toBe('var(--ui-surface-elevated)');
      expect(metaChipStyle.boxShadow).toBe('var(--kanban-card-chip-inset)');
      expect(runChipStyle.background).toBe('var(--ui-surface-elevated-strong)');

      for (const tooltipStyle of tooltipStyles) {
        expect(tooltipStyle.getPropertyValue('--kanban-card-tooltip-surface')).toBe(
          'var(--ui-tooltip-surface)',
        );
        expect(tooltipStyle.getPropertyValue('--kanban-card-tooltip-text')).toBe(
          'var(--ui-tooltip-text)',
        );
        expect(tooltipStyle.getPropertyValue('--kanban-card-tooltip-border')).toBe(
          'var(--ui-tooltip-border)',
        );
        expect(tooltipStyle.background).toBe('var(--kanban-card-tooltip-surface)');
        expect(tooltipStyle.color).toBe('var(--kanban-card-tooltip-text)');
        expect(
          [
            tooltipStyle.getPropertyValue('--kanban-card-tooltip-surface'),
            tooltipStyle.getPropertyValue('--kanban-card-tooltip-text'),
            tooltipStyle.getPropertyValue('--kanban-card-tooltip-border'),
          ].join('\n'),
        ).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba\(/);
      }
    } finally {
      cleanupFixture();
    }
  });

  it('marks hold cards with a left warning accent instead of coloring the whole lane', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardHold::before\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*0;[\s\S]*width:\s*4px;[\s\S]*background:\s*linear-gradient\(/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardHold::before\s*\{[\s\S]*box-shadow:\s*0 0 16px color-mix\(in srgb,\s*var\(--ui-warning\),\s*transparent 42%\);/,
    );
    expect(cardsCss).toMatch(/\.kanbanQueuedWarningIcon\s*\{/);
  });

  it('marks unread update cards with a left success accent', () => {
    expect(cardsCss).toMatch(
      /\.kanbanCardUpdated::before\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*0;[\s\S]*width:\s*4px;[\s\S]*background:\s*linear-gradient\([\s\S]*var\(--ui-success\)/,
    );
    expect(cardsCss).toMatch(
      /\.kanbanCardUpdated::before\s*\{[\s\S]*color-mix\(in srgb,\s*var\(--ui-success\),\s*var\(--ui-neutral-strong\) 18%\)/,
    );
    expect(cardsCss).not.toContain('#0f6b45');
    expect(cardsCss).toMatch(
      /\.kanbanCardUpdated::before\s*\{[\s\S]*box-shadow:\s*0 0 16px color-mix\(in srgb,\s*var\(--ui-success\),\s*transparent 42%\);/,
    );
  });

  it('renders unread update cards with the success rail class, debug attribute, and hidden status text', () => {
    const { desktopHtml } = renderQueuedTaskSurfaces({
      ...BASE_TASK,
      hasUnreadNotification: true,
    });

    expect(desktopHtml).toContain('kanbanCardUpdated');
    expect(desktopHtml).toContain('data-has-unread-notification="true"');
    expect(desktopHtml).toContain('kanbanCardUnreadStatus');
    expect(desktopHtml).toContain('Unread update');
    expect(desktopHtml).not.toContain('aria-label="Open task');
  });

  it('renders stale queued desktop and mobile cards with the warning accent and hidden emoji', () => {
    const staleTask: KanbanTask = {
      ...BASE_TASK,
      runState: 'queued',
      runStateUpdatedAt: '2020-01-01T00:00:00.000Z',
    };

    const { desktopHtml, mobileHtml } = renderQueuedTaskSurfaces(staleTask);

    for (const html of [desktopHtml, mobileHtml]) {
      expect(html).toContain('kanbanCardHold');
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

  it('renders empty columns with a top-only aurora seam instead of a bordered panel', () => {
    const emptyStateRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact');
    const emptyStateAuroraRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact::before');
    const emptyStateSeamRule = getCssRuleBody(globalsCss, '.kanban-empty-state--compact::after');

    expect(emptyStateRule).toContain('background: transparent;');
    expect(emptyStateRule).toContain('flex-direction: column;');
    expect(emptyStateRule).toContain('justify-content: flex-start;');
    expect(emptyStateRule).not.toContain('border:');
    expect(emptyStateRule).not.toContain('border-radius:');

    expect(emptyStateAuroraRule).toContain('position: absolute;');
    expect(emptyStateAuroraRule).toContain('top: 0;');
    expect(emptyStateAuroraRule).toContain('filter: blur(');
    expect(emptyStateAuroraRule).toContain('linear-gradient(');

    expect(emptyStateSeamRule).toContain('position: absolute;');
    expect(emptyStateSeamRule).toContain('height: 1px;');
    expect(emptyStateSeamRule).toContain('linear-gradient(');
    expect(emptyStateSeamRule).toContain('90deg');
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
      /\.kanbanMetaChip\s*\{[\s\S]*gap:\s*5px;[\s\S]*min-height:\s*26px;[\s\S]*padding:\s*0 8px;[\s\S]*font-size:\s*0\.66rem;/,
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
    expect(html).toContain('aria-label="#Bug #Frontend"');
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
    expect(html).toContain(
      'aria-label="#Bugfix #Frontend #UI #Accessibility #Review Needed #Responsive"',
    );
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
    expect(dispatch.message).not.toContain('!/preqstation dispatch');
  });
});
