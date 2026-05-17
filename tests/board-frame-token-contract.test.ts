// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const droppableState = vi.hoisted(() => ({
  isDraggingOver: false,
}));
const pullToRefreshState = vi.hoisted(() => ({
  isArmed: false,
  pullDistance: 0,
  pullProgress: 0,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children, droppableId }: any) =>
    children(
      { innerRef: vi.fn(), droppableProps: { 'data-droppable-id': droppableId } },
      { isDraggingOver: droppableState.isDraggingOver },
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

vi.mock('@/app/hooks/use-mobile-pull-to-refresh', () => ({
  useMobilePullToRefresh: () => ({
    bindScrollContainer: () => {},
    isArmed: pullToRefreshState.isArmed,
    pullDistance: pullToRefreshState.pullDistance,
    pullProgress: pullToRefreshState.pullProgress,
    onTouchStart: () => {},
    onTouchMove: () => {},
    onTouchEnd: () => {},
    onTouchCancel: () => {},
  }),
}));

vi.mock('@/app/hooks/use-mobile-tab-swipe', () => ({
  useMobileTabSwipe: () => ({ onTouchStart: () => {}, onTouchEnd: () => {} }),
}));

import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';
import { KanbanCardContent } from '@/app/components/kanban-card';
import { KanbanColumn } from '@/app/components/kanban-column';
import { KanbanQuickAdd } from '@/app/components/kanban-quick-add';
import type { KanbanColumns, KanbanStatus, KanbanTask } from '@/lib/kanban-helpers';

// JSDOM needs the app stylesheet installed before computed-style assertions can observe it.
const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
let globalsStyle: HTMLStyleElement | null = null;

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

function makeTask(status: KanbanStatus): KanbanTask {
  return {
    id: `${status}-1`,
    taskKey: `PROJ-${status}`,
    title: `${status} task`,
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

function renderWithMantine(element: React.ReactElement) {
  return render(React.createElement(MantineProvider, null, element));
}

function getElement(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);

  expect(element, `Expected rendered element for ${selector}`).not.toBeNull();

  return element!;
}

function expectComputedToken(selector: string, property: string, token: string) {
  const value = window.getComputedStyle(getElement(selector)).getPropertyValue(property);

  expect(value).toContain(`var(${token})`);
  expect(value).not.toContain('rgba(');
  expect(value).not.toContain('#');
  expect(value).not.toContain('white');
  expect(value).not.toContain('black');
}

function parseHexColor(value: string): [number, number, number] {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);

  expect(match, `Expected ${value} to be a six-digit hex color`).not.toBeNull();

  const hex = match![1];

  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const scaled = channel / 255;

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]) {
  const foregroundLum = relativeLuminance(foreground);
  const backgroundLum = relativeLuminance(background);
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);

  return (lighter + 0.05) / (darker + 0.05);
}

function expectTokenContrast(token: string, backgroundHex: string, minimumRatio: number) {
  const rootStyle = window.getComputedStyle(document.documentElement);
  const foreground = parseHexColor(rootStyle.getPropertyValue(token));
  const background = parseHexColor(backgroundHex);

  expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimumRatio);
}

describe('board frame token contract', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
    globalsStyle = document.createElement('style');
    globalsStyle.textContent = globalsCss;
    document.head.appendChild(globalsStyle);
  });

  beforeEach(() => {
    document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
    droppableState.isDraggingOver = false;
    pullToRefreshState.isArmed = false;
    pullToRefreshState.pullDistance = 0;
    pullToRefreshState.pullProgress = 0;
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    globalsStyle?.remove();
    globalsStyle = null;
  });

  it('defines the shared board chrome token hierarchy on the rendered root', () => {
    const rootStyle = window.getComputedStyle(document.documentElement);

    for (const token of [
      '--kanban-frame-stage-surface',
      '--kanban-frame-column-surface',
      '--kanban-frame-column-border',
      '--kanban-frame-chrome-surface',
      '--kanban-frame-chrome-surface-hover',
      '--kanban-frame-chrome-border',
      '--kanban-frame-chrome-highlight',
      '--kanban-frame-chrome-shadow',
      '--kanban-frame-mobile-tab-shadow',
    ]) {
      expect(rootStyle.getPropertyValue(token).trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the mobile tab bar separator shadow pointed upward', () => {
    const rootStyle = window.getComputedStyle(document.documentElement);

    renderWithMantine(
      React.createElement(KanbanBoardMobile, {
        columns: emptyColumns(),
        activeTab: 'inbox',
        onTabChange: () => {},
        isPending: false,
        editHrefBase: '/board',
        editHrefJoiner: '?',
        router: { push: () => {}, refresh: () => {} } as never,
        onRefresh: () => {},
        onQuickMoveTask: () => {},
        onDeleteTask: () => {},
        saveError: null,
        enginePresets: null,
      }),
    );

    expect(getElement('.kanban-mobile-tab-bar').classList).toContain('kanban-mobile-tab-bar');
    expect(rootStyle.getPropertyValue('--kanban-frame-mobile-tab-shadow')).toMatch(/^0px\s+-/);
  });

  it('keeps light-mode status button foreground tokens contrast-safe', () => {
    expectTokenContrast('--ui-status-queued-foreground', '#ffffff', 3);
    expectTokenContrast('--ui-status-running-foreground', '#ffffff', 3);
  });

  it('maps dark-mode status button foreground tokens back to status colors', () => {
    document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');

    const rootStyle = window.getComputedStyle(document.documentElement);

    expect(rootStyle.getPropertyValue('--ui-status-queued-foreground')).toContain(
      'var(--ui-status-queued)',
    );
    expect(rootStyle.getPropertyValue('--ui-status-running-foreground')).toContain(
      'var(--ui-status-running)',
    );
  });

  it('computes desktop columns, quick add, and action island chrome from board tokens', () => {
    renderWithMantine(
      React.createElement(
        React.Fragment,
        null,
        React.createElement('div', { className: 'kanban-action-island' }),
        React.createElement(KanbanColumn, {
          status: 'inbox',
          tasks: [],
          isPending: false,
          isMobile: false,
          editHrefBase: '/board',
          editHrefJoiner: '?',
          router: { push: () => {} } as never,
          onQuickMoveTask: () => {},
          onDeleteTask: () => {},
          enginePresets: null,
        }),
        React.createElement(KanbanQuickAdd, {
          selectedProject: { id: 'project-1', name: 'Project One' },
          projectOptions: [],
          editHrefBase: '/board',
          editHrefJoiner: '?',
          onClose: () => {},
        }),
      ),
    );

    expectComputedToken('.kanban-action-island', 'background', '--kanban-frame-chrome-surface');
    expectComputedToken('.kanban-action-island', 'box-shadow', '--kanban-frame-chrome-shadow');
    expectComputedToken('.kanban-action-island', 'box-shadow', '--kanban-frame-chrome-highlight');
    expectComputedToken('.kanban-column', 'background', '--kanban-frame-column-surface');
    expectComputedToken('.kanban-column', 'box-shadow', '--kanban-frame-column-border');
    expectComputedToken('.kanban-quickadd-panel', 'background', '--kanban-frame-chrome-surface');
  });

  it('renders mobile tab and refresh hooks through the mobile board component', () => {
    pullToRefreshState.isArmed = true;
    pullToRefreshState.pullDistance = 42;
    pullToRefreshState.pullProgress = 0.75;

    renderWithMantine(
      React.createElement(KanbanBoardMobile, {
        columns: emptyColumns(),
        activeTab: 'inbox',
        onTabChange: () => {},
        isPending: false,
        editHrefBase: '/board',
        editHrefJoiner: '?',
        router: { push: () => {}, refresh: () => {} } as never,
        onRefresh: () => {},
        onQuickMoveTask: () => {},
        onDeleteTask: () => {},
        actionIsland: React.createElement(
          'div',
          { className: 'kanban-action-island-anchor kanban-mobile-action-island-anchor' },
          React.createElement('div', { className: 'kanban-action-island' }),
        ),
        saveError: 'Could not save the board.',
        enginePresets: null,
      }),
    );

    expect(getElement('.kanban-mobile-tab-bar')).toBeTruthy();
    expect(getElement('.kanban-mobile-tabs .mantine-Tabs-list')).toBeTruthy();
    expect(getElement('.kanban-action-island')).toBeTruthy();

    const refreshIndicator = getElement('.kanban-mobile-refresh-indicator');
    expect(refreshIndicator.dataset.state).toBe('armed');
    expect(refreshIndicator.dataset.armed).toBe('true');
    const panelBody = getElement('.kanban-mobile-panel-body');
    expect(panelBody.style.getPropertyValue('--kanban-mobile-refresh-progress')).toBe('0.75');

    expect(screen.getByText('Could not save the board.').classList).toContain(
      'kanban-mobile-save-error',
    );
  });

  it('computes semantic state colors from rendered state hooks', () => {
    droppableState.isDraggingOver = true;

    renderWithMantine(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(KanbanColumn, {
          status: 'todo',
          tasks: [],
          isPending: false,
          isMobile: false,
          editHrefBase: '/board',
          editHrefJoiner: '?',
          router: { push: () => {} } as never,
          onQuickMoveTask: () => {},
          onDeleteTask: () => {},
          enginePresets: null,
        }),
        React.createElement('div', { className: 'kanban-column is-drag-over' }),
        React.createElement('p', { className: 'kanban-archive-error' }, 'Archive load failed'),
        ...(['inbox', 'hold', 'ready', 'done', 'archived'] satisfies KanbanStatus[]).map((status) =>
          React.createElement(KanbanCardContent, {
            key: status,
            task: makeTask(status),
            isPending: false,
            isMobile: false,
            editHref: `/board?taskId=PROJ-${status}`,
            telegramEnabled: false,
            onQuickMoveTask: () => {},
            onDeleteTask: () => {},
            enginePresets: null,
            labelOptions: [],
          }),
        ),
      ),
    );

    expectComputedToken(
      '.kanban-column-body.is-drag-over',
      'background',
      '--ui-status-running-soft',
    );
    expectComputedToken('.kanban-column.is-drag-over', 'box-shadow', '--ui-status-running-border');
    expectComputedToken('.kanban-archive-error', 'color', '--ui-danger');
    expectComputedToken('.kanban-status-button.is-inbox', 'color', '--ui-status-queued-foreground');
    expectComputedToken('.kanban-status-button.is-hold', 'color', '--ui-warning');
    expectComputedToken(
      '.kanban-status-button.is-ready',
      'color',
      '--ui-status-running-foreground',
    );
    expectComputedToken('.kanban-status-button.is-done', 'color', '--ui-success');
    expectComputedToken('.kanban-status-button.is-archived', 'color', '--ui-muted-text');
  });
});
