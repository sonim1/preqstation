import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const mobileBoardSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/kanban-board-mobile.tsx'),
  'utf8',
);
const archiveDrawerSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/kanban-archive-drawer.tsx'),
  'utf8',
);

function escapeSelector(selector: string) {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRule(selector: string) {
  const match = globalsCss.match(
    new RegExp(`(?:^|\\n)\\s*${escapeSelector(selector)}\\s*\\{([^}]*)\\}`),
  );

  expect(match, `Expected CSS rule for ${selector}`).not.toBeNull();

  return match![1];
}

function expectNoRawBoardColor(rule: string) {
  expect(rule).not.toMatch(/rgba\(/);
  expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(rule).not.toMatch(/color-mix\(in srgb,[^;]*(?:\bwhite\b|\bblack\b)/);
  expect(rule).not.toContain('color: white;');
}

describe('board frame token contract', () => {
  it('defines a shared board chrome token hierarchy', () => {
    for (const token of [
      '--kanban-frame-stage-surface',
      '--kanban-frame-column-surface',
      '--kanban-frame-column-border',
      '--kanban-frame-chrome-surface',
      '--kanban-frame-chrome-surface-hover',
      '--kanban-frame-chrome-border',
      '--kanban-frame-chrome-shadow',
    ]) {
      expect(globalsCss).toContain(`${token}:`);
    }
  });

  it('keeps desktop columns, quick add, action island, and mobile tabs on board chrome tokens', () => {
    const expectations: Array<[selector: string, tokens: string[]]> = [
      [
        '.kanban-action-island',
        ['var(--kanban-frame-chrome-surface)', 'var(--kanban-frame-chrome-shadow)'],
      ],
      [
        '.kanban-column',
        ['var(--kanban-frame-column-surface)', 'var(--kanban-frame-column-border)'],
      ],
      [
        '.kanban-quickadd-panel',
        ['var(--kanban-frame-chrome-surface)', 'var(--kanban-frame-chrome-border)'],
      ],
      [
        '.kanban-mobile-tab-bar',
        ['var(--kanban-frame-chrome-surface)', 'var(--kanban-frame-chrome-shadow)'],
      ],
      [
        '.kanban-mobile-tabs .mantine-Tabs-list',
        ['var(--kanban-frame-chrome-surface)', 'var(--kanban-frame-chrome-border)'],
      ],
    ];

    for (const [selector, tokens] of expectations) {
      const rule = getRule(selector);

      for (const token of tokens) {
        expect(rule).toContain(token);
      }

      expectNoRawBoardColor(rule);
    }
  });

  it('uses semantic state tokens for board drag, refresh, save-error, and status states', () => {
    expect(getRule('.kanban-column-body.is-drag-over')).toContain('var(--ui-status-running-soft)');
    expect(getRule('.kanban-column.is-drag-over')).toContain(
      'var(--ui-status-running-border-strong)',
    );
    expect(getRule(".kanban-mobile-refresh-indicator[data-state='refreshing']")).toContain(
      'var(--ui-status-running)',
    );
    expect(getRule(".kanban-mobile-refresh-indicator[data-state='success']")).toContain(
      'var(--ui-success)',
    );
    expect(getRule('.kanban-mobile-save-error')).toContain('var(--ui-danger)');
    expect(getRule('.kanban-archive-error')).toContain('var(--ui-danger)');
    expect(getRule('.kanban-status-button.is-inbox')).toContain('var(--ui-status-queued)');
    expect(getRule('.kanban-status-button.is-hold')).toContain('var(--ui-warning)');
    expect(getRule('.kanban-status-button.is-ready')).toContain('var(--ui-status-running)');
    expect(getRule('.kanban-status-button.is-done')).toContain('var(--ui-success)');

    expect(mobileBoardSource).not.toContain('c="red"');
    expect(archiveDrawerSource).not.toContain('c="red"');
  });
});
