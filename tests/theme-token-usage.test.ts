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

function getDefinedUiTokens(source: string) {
  return new Set(Array.from(source.matchAll(/(--ui-[\w-]+)\s*:/g), ([, token]) => token));
}

function getReferencedUiTokens(source: string) {
  return new Set(Array.from(source.matchAll(/var\((--ui-[\w-]+)/g), ([, token]) => token));
}

function getMantineBridgeRuleBodies(source: string) {
  const start = source.indexOf(".mantine-Button-root[data-variant='light'],");
  const end = source.indexOf("html[data-mantine-color-scheme='dark'] .kanban-column");

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const bridgeSource = source.slice(start, end);

  return Array.from(
    bridgeSource.matchAll(
      /[^{}]*\.mantine-(?:Button|ActionIcon|Badge|Input|Textarea|Select|NativeSelect|Combobox)[^{}]*\{([^{}]*)\}/g,
    ),
    ([, body]) => body,
  );
}

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

  it('keeps app-level ui token references defined in globals', () => {
    const definedTokens = getDefinedUiTokens(globalsCss);
    const missingTokens = Array.from(getReferencedUiTokens(globalsCss)).filter(
      (token) => !definedTokens.has(token),
    );

    expect(missingTokens).toEqual([]);
  });

  it('keeps Mantine component bridge overrides on semantic tokens', () => {
    const rawColorPattern =
      /(?:rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b|color-mix\([^)]*\b(?:white|black)\b|(?:color|background|border-color):\s*(?:white|black)\b|var\(--mantine-color-(?:blue|gray|white|black)[^)]+\))/;
    const rawBridgeBodies = getMantineBridgeRuleBodies(globalsCss).filter((body) =>
      rawColorPattern.test(body),
    );

    expect(rawBridgeBodies).toEqual([]);
  });
});
