import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider, Menu } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import {
  getRunStateWaveConfig,
  KanbanCardContent,
  KanbanCardMenuDropdown,
  resolveKanbanCardMenuPosition,
  resolveLabelHashStyle,
  resolveRunStateFrameStyle,
} from '@/app/components/kanban-card';
import type { KanbanTask } from '@/lib/kanban-helpers';

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

describe('app/components/kanban-card', () => {
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
    expect(globalsCss).toMatch(
      /\.kanban-stage\s*\{[\s\S]*background:\s*var\(--kanban-stage-surface\);/,
    );
  });

  it('renders boundary-free lanes with subtly rounded note cards carried by shadows', () => {
    expect(globalsCss).toMatch(
      /\.kanban-column\s*\{[\s\S]*--kanban-bottom-gradient-surface:\s*transparent;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/,
    );
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
      editHref: '/board?panel=task-edit&taskId=PROJ-211',
      telegramEnabled: true,
      telegramDispatchSummary: 'Engine: Codex CLI | Target: Telegram | Mode: Implement',
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
    expect(html).toContain('data-kanban-dispatch-detail="true"');
    expect(html).not.toContain('data-kanban-dispatch-summary="true"');
    expect(html).toContain('Engine: Codex CLI | Target: Telegram | Mode: Implement');
    expect(html).toContain('Move to Planned');
    expect(html).not.toContain('Move to Todo');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
    expect(html).not.toContain('Open Project');
  });
});
