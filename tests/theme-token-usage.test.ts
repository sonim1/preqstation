import fs from 'node:fs';
import { createRequire } from 'node:module';
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
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (html?: string) => {
    window: Window & typeof globalThis;
  };
};

function getDefinedUiTokens(source: string) {
  return new Set(Array.from(source.matchAll(/(--ui-[\w-]+)\s*:/g), ([, token]) => token));
}

function getReferencedUiTokens(source: string) {
  return new Set(Array.from(source.matchAll(/var\((--ui-[\w-]+)/g), ([, token]) => token));
}

function renderCssFixture(body: string, colorScheme: 'light' | 'dark' = 'light') {
  const schemeAttribute = colorScheme === 'dark' ? ' data-mantine-color-scheme="dark"' : '';

  return new JSDOM(`
    <html${schemeAttribute}>
      <head><style>${globalsCss}</style></head>
      <body>${body}</body>
    </html>
  `);
}

function getFixtureElement(dom: InstanceType<typeof JSDOM>, testId: string) {
  const element = dom.window.document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  expect(element).not.toBeNull();

  return element!;
}

function expectComputedProperties(
  dom: InstanceType<typeof JSDOM>,
  testId: string,
  expectedProperties: Record<string, string>,
) {
  const style = dom.window.getComputedStyle(getFixtureElement(dom, testId));

  for (const [property, value] of Object.entries(expectedProperties)) {
    expect(style.getPropertyValue(property)).toBe(value);
  }
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

  it('renders Mantine component bridge overrides with semantic tokens', () => {
    const lightDom = renderCssFixture(`
      <button data-testid="light-button" class="mantine-Button-root" data-variant="light"></button>
      <button
        data-testid="danger-action"
        class="mantine-ActionIcon-root"
        data-variant="light"
        data-color="red"
      ></button>
      <button
        data-testid="success-subtle"
        class="mantine-Button-root"
        data-variant="subtle"
        data-color="green"
      ></button>
      <span
        data-testid="warning-badge"
        class="mantine-Badge-root"
        data-variant="outline"
        data-color="orange"
      ></span>
      <input data-testid="input" class="mantine-Input-input" />
      <textarea data-testid="textarea" class="mantine-Textarea-input"></textarea>
      <input data-testid="select" class="mantine-Select-input" />
      <select data-testid="native-select" class="mantine-NativeSelect-input"></select>
      <div data-testid="dropdown" class="mantine-Combobox-dropdown"></div>
      <div data-testid="option" class="mantine-Combobox-option"></div>
      <div
        data-testid="selected-option"
        class="mantine-Combobox-option"
        data-combobox-selected
      ></div>
    `);
    const darkDom = renderCssFixture(
      `
        <button
          data-testid="dark-light-button"
          class="mantine-Button-root"
          data-variant="light"
        ></button>
        <div
          data-testid="dark-selected-option"
          class="mantine-Combobox-option"
          data-combobox-selected
        ></div>
      `,
      'dark',
    );

    expectComputedProperties(lightDom, 'light-button', {
      background: 'var(--ui-accent-soft)',
      color: 'var(--ui-accent-strong)',
    });
    expectComputedProperties(lightDom, 'danger-action', {
      background: 'var(--ui-danger-soft)',
      color: 'var(--ui-danger)',
    });
    expectComputedProperties(lightDom, 'success-subtle', {
      color: 'var(--ui-success)',
    });
    expectComputedProperties(lightDom, 'warning-badge', {
      background: 'var(--ui-warning-soft)',
      color: 'var(--ui-warning)',
    });

    for (const testId of ['input', 'textarea', 'select', 'native-select']) {
      expectComputedProperties(lightDom, testId, {
        background: 'var(--ui-surface-soft)',
        color: 'var(--ui-text)',
      });
    }

    expectComputedProperties(lightDom, 'dropdown', {
      background: 'var(--ui-surface-strong)',
      'box-shadow': 'var(--ui-elevation-3)',
    });
    expectComputedProperties(lightDom, 'option', {
      color: 'var(--ui-text)',
    });
    expectComputedProperties(lightDom, 'selected-option', {
      background: 'color-mix(in srgb, var(--ui-accent) 74%, var(--ui-surface-strong))',
      color: 'var(--ui-text)',
    });
    expectComputedProperties(darkDom, 'dark-light-button', {
      background: 'var(--ui-accent-soft)',
      color: 'color-mix(in srgb, var(--ui-accent), var(--ui-text) 68%)',
    });
    expectComputedProperties(darkDom, 'dark-selected-option', {
      background: 'color-mix(in srgb, var(--ui-accent) 74%, var(--ui-surface-strong))',
      color: 'var(--ui-text)',
    });
  });
});
