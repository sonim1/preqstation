import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);
const taskPanelCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-panel-modal.module.css'),
  'utf8',
);

function getRuleBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? '';
}

describe('kanban board HTML handoff design system', () => {
  it('maps board workflow surfaces to the warm paper handoff token aliases', () => {
    expect(globalsCss).toContain('--kanban-board-bg: var(--workspace-paper-bg);');
    expect(globalsCss).toContain('--kanban-board-surface: var(--workspace-paper-surface);');
    expect(globalsCss).toContain('--kanban-board-border: var(--workspace-paper-border);');
    expect(globalsCss).toContain('--kanban-board-soft: var(--workspace-paper-soft);');
    expect(globalsCss).toContain('--kanban-board-accent: var(--workspace-paper-accent);');
    expect(cardsCss).toContain('--kanban-card-bg: var(--workspace-paper-surface);');
    expect(cardsCss).toContain('--kanban-card-chip-bg: var(--workspace-paper-bg);');
  });

  it('renders board columns as bordered paper lanes instead of transparent glass lanes', () => {
    const stageRule = getRuleBody(globalsCss, '.kanban-stage');
    const columnRule = getRuleBody(globalsCss, '.kanban-column');
    const columnHeaderRule = getRuleBody(globalsCss, '.kanban-column-header');

    expect(stageRule).toContain('background: var(--kanban-board-bg);');
    expect(columnRule).toContain('border: 1px solid var(--kanban-board-border);');
    expect(columnRule).toContain('border-radius: 8px;');
    expect(columnRule).toContain('background: var(--kanban-board-surface);');
    expect(columnRule).toContain('box-shadow: none;');
    expect(columnHeaderRule).toContain('border-bottom: 1px solid var(--kanban-board-border);');
  });

  it('renders task cards as compact bordered paper cards with badge-driven metadata', () => {
    const cardRule = getRuleBody(cardsCss, '.kanbanCard');
    const itemCardRule = getRuleBody(cardsCss, '.itemCard.kanbanCard');
    const metaChipRule = getRuleBody(cardsCss, '.kanbanMetaChip');

    expect(cardRule).toContain('border: 1px solid var(--kanban-card-border);');
    expect(cardRule).toContain('background: var(--kanban-card-bg);');
    expect(cardRule).toContain('box-shadow: none;');
    expect(itemCardRule).toContain('border: 1px solid var(--kanban-card-border);');
    expect(metaChipRule).toContain('border: 1px solid var(--kanban-card-border);');
    expect(metaChipRule).toContain('border-radius: 20px;');
    expect(metaChipRule).toContain('background: var(--kanban-card-chip-bg);');
    expect(metaChipRule).toContain('min-height: 24px;');
  });

  it('keeps task panels on paper surfaces rather than blurred glass chrome', () => {
    const contentRule = getRuleBody(taskPanelCss, '.content');

    expect(contentRule).toContain('border: 1px solid var(--kanban-board-border);');
    expect(contentRule).toContain('background: var(--kanban-board-surface);');
    expect(contentRule).toContain('box-shadow: none;');
    expect(contentRule).not.toContain('backdrop-filter');
  });
});
