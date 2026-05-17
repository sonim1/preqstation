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
const projectDetailCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/project/[key]/project-detail-page.module.css'),
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

  it('reuses shared ui tokens across panels, handoff project surfaces, and kanban card chrome', () => {
    expect(panelsCss).toContain('var(--ui-panel-orb)');
    expect(panelsCss).toContain('blur(var(--ui-panel-blur))');
    expect(projectsCss).toContain('var(--ui-surface-panel)');
    expect(projectsCss).toContain('--project-card-bg: var(--workspace-paper-surface);');
    expect(projectsCss).toContain('--project-accent: var(--workspace-paper-accent);');
    expect(projectsCss).toContain('var(--project-border)');
    expect(projectsCss).toContain('var(--ui-surface-elevated)');
    expect(projectsCss).not.toContain('#112136');
    expect(cardsCss).toContain('var(--ui-surface-elevated)');
    expect(cardsCss).toContain('var(--ui-surface-elevated-strong)');
    expect(cardsCss).toContain('var(--ui-status-running)');
    expect(cardsCss).toContain('var(--ui-status-queued)');
  });

  it('keeps handoff project module CSS free of hardcoded hex colors', () => {
    const summaryPillRule = projectsCss.match(/\.summaryPill\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(summaryPillRule).toContain('border: 1px solid var(--project-border);');
    expect(summaryPillRule).toContain('background: var(--project-bg);');
    expect(projectsCss).not.toMatch(hexColorPattern);
    expect(projectDetailCss).toContain('--detail-fg: var(--workspace-paper-fg);');
    expect(projectDetailCss).toContain('--detail-body: var(--workspace-paper-body);');
    expect(projectDetailCss).not.toMatch(hexColorPattern);
  });
});
