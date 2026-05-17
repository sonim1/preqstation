import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const panelsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/panels.module.css'),
  'utf8',
);
const projectsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/projects/projects-page.module.css'),
  'utf8',
);
const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);
const globalErrorSource = fs.readFileSync(path.join(process.cwd(), 'app/global-error.tsx'), 'utf8');
const designSystemPath = path.join(process.cwd(), 'DESIGN.md');
const hexColorPattern = /#[0-9a-f]{3,8}\b/i;

describe('theme token usage audit fixes', () => {
  it('documents the lightweight design system token contract', () => {
    expect(fs.existsSync(designSystemPath)).toBe(true);

    const designSystem = fs.readFileSync(designSystemPath, 'utf8');

    expect(designSystem).toContain('# Design System - Preq Station');
    expect(designSystem).toContain('## Token Contract');
    expect(designSystem).toContain('Canonical tokens live in `app/globals.css`');
    expect(designSystem).toContain('`--ui-surface`');
    expect(designSystem).toContain('`--ui-accent`');
    expect(designSystem).toContain('`--ui-hit-touch-min`');
  });

  it('defines shared surface and state tokens for audited surfaces', () => {
    expect(globalsCss).toMatch(/--ui-surface-elevated:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-surface-panel:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-overlay-surface:/);
    expect(globalsCss).toMatch(/--ui-overlay-text:/);
    expect(globalsCss).toMatch(/--ui-overlay-border:/);
    expect(globalsCss).toMatch(/--ui-panel-orb:/);
    expect(globalsCss).toMatch(/--ui-status-running:/);
  });

  it('maps workspace paper aliases to theme-aware ui tokens', () => {
    expect(globalsCss).toContain('--workspace-paper-bg: var(--ui-surface-soft);');
    expect(globalsCss).toContain('--workspace-paper-surface: var(--ui-surface-strong);');
    expect(globalsCss).toContain('--workspace-paper-fg: var(--ui-text);');
    expect(globalsCss).toContain('--workspace-paper-body: var(--ui-text);');
    expect(globalsCss).toContain('--workspace-paper-muted: var(--ui-muted-text);');
    expect(globalsCss).toContain('--workspace-paper-border: var(--ui-border);');
    expect(globalsCss).toContain('--workspace-paper-soft: var(--ui-neutral-soft);');
    expect(globalsCss).toContain('--workspace-paper-accent: var(--ui-accent);');
    expect(globalsCss).toContain('--workspace-paper-on-accent: var(--ui-accent-contrast);');
    expect(globalsCss).toContain('--kanban-board-on-accent: var(--workspace-paper-on-accent);');
  });

  it('keeps task dispatch bottom picker menus on theme tokens', () => {
    const pickerRule = globalsCss.match(/\.task-dispatch-bottom-picker\s*\{([^}]*)\}/);
    const menuRule = globalsCss.match(/\.task-dispatch-bottom-menu\s*\{([^}]*)\}/);

    expect(pickerRule?.[1]).toContain('color: var(--ui-text);');
    expect(pickerRule?.[1]).toContain('var(--ui-border)');
    expect(pickerRule?.[1]).toContain('var(--ui-surface-strong)');
    expect(menuRule?.[1]).toContain('color: var(--ui-text);');
    expect(menuRule?.[1]).toContain('var(--ui-border)');
    expect(menuRule?.[1]).toContain('var(--ui-surface-elevated)');
  });

  it('moves the global error page onto app tokens instead of a file-local palette', () => {
    expect(globalErrorSource).toContain('var(--ui-surface');
    expect(globalErrorSource).toContain('var(--ui-text');
    expect(globalErrorSource).toContain('var(--ui-border');
    expect(globalErrorSource).not.toContain("background: '#0b1220'");
    expect(globalErrorSource).not.toContain("color: '#e8effa'");
  });

  it('reuses shared ui tokens across panels, project surfaces, and kanban card chrome', () => {
    expect(panelsCss).toContain('var(--ui-panel-orb)');
    expect(panelsCss).toContain('blur(var(--ui-panel-blur))');
    expect(projectsCss).toContain('var(--ui-surface-panel)');
    expect(projectsCss).toContain('var(--ui-surface-muted)');
    expect(projectsCss).toContain('var(--ui-surface-elevated)');
    expect(projectsCss).not.toContain('#112136');
    expect(cardsCss).toContain('var(--ui-surface-elevated)');
    expect(cardsCss).toContain('var(--ui-surface-elevated-strong)');
    expect(cardsCss).toContain('var(--ui-status-running)');
    expect(cardsCss).toContain('var(--ui-status-queued)');
  });

  it('keeps restored project and card CSS free of hardcoded hex colors', () => {
    const summaryPillRule = projectsCss.match(/\.summaryPill\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(summaryPillRule).not.toMatch(hexColorPattern);
    expect(projectsCss).not.toMatch(hexColorPattern);
    expect(cardsCss).not.toMatch(hexColorPattern);
    expect(cardsCss).toContain('--kanban-tooltip-fg: var(--ui-overlay-text);');
    expect(cardsCss).toContain('color: var(--kanban-tooltip-fg);');
  });

  it('keeps dark kanban rules limited to token overrides', () => {
    const darkKanbanSurfaceRule =
      cardsCss.match(
        /:global\(html\[data-mantine-color-scheme='dark'\]\) \.kanbanCard,\s*:global\(html\[data-mantine-color-scheme='dark'\]\) \.itemCard\.kanbanCard\s*\{([^}]*)\}/,
      )?.[1] ?? '';
    const darkKanbanShadowRule =
      cardsCss.match(
        /:global\(html\[data-mantine-color-scheme='dark'\]\) \.kanbanCard\s*\{([^}]*)\}/,
      )?.[1] ?? '';
    const darkMetaChipRule =
      cardsCss.match(
        /:global\(html\[data-mantine-color-scheme='dark'\]\) \.kanbanMetaChip\s*\{([^}]*)\}/,
      )?.[1] ?? '';

    expect(darkKanbanSurfaceRule).toContain('--kanban-note-surface:');
    expect(darkKanbanSurfaceRule).not.toMatch(/\bbackground:/);
    expect(darkKanbanShadowRule).toContain('--kanban-card-shadow-rest:');
    expect(darkKanbanShadowRule).not.toMatch(/\bbox-shadow:/);
    expect(darkMetaChipRule).toContain('border-color:');
    expect(darkMetaChipRule).not.toMatch(/\bbackground:/);
    expect(darkMetaChipRule).not.toMatch(/^\s*color:/m);
    expect(cardsCss).not.toMatch(
      /:global\(html\[data-mantine-color-scheme='dark'\]\) \.kanbanCardFrame\s*\{/,
    );
    expect(cardsCss).not.toMatch(
      /:global\(html\[data-mantine-color-scheme='dark'\]\) \.kanbanRunStateChip\s*\{/,
    );
  });
});
