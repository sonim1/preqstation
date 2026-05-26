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
const projectDetailCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/project/[key]/project-detail-page.module.css'),
  'utf8',
);
const cardsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/cards.module.css'),
  'utf8',
);
const taskPanelModalCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/task-panel-modal.module.css'),
  'utf8',
);
const readyQaActionsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/ready-qa-actions.module.css'),
  'utf8',
);
const settingsPageCss = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/settings/settings-page.module.css'),
  'utf8',
);
const settingsControlsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/settings-controls.module.css'),
  'utf8',
);
const telegramSettingsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/telegram-settings.module.css'),
  'utf8',
);
const taskFormPanelCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/panels/task-form-panel.module.css'),
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

function renderCssFixture(
  body: string,
  colorScheme: 'light' | 'dark' = 'light',
  cssSources: string[] = [],
) {
  const schemeAttribute = colorScheme === 'dark' ? ' data-mantine-color-scheme="dark"' : '';
  const styleTags = [globalsCss, ...cssSources].map((css) => `<style>${css}</style>`).join('');

  return new JSDOM(`
    <html${schemeAttribute}>
      <head>${styleTags}</head>
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
    expect(designSystem).toContain('`--ui-workflow-status-inbox`');
    expect(designSystem).toContain('`--ui-hit-touch-min`');
  });

  it('defines shared surface and state tokens for audited surfaces', () => {
    expect(globalsCss).toMatch(/--ui-surface-elevated:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-surface-panel:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-surface-modal:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-surface-modal-header:\s*linear-gradient/);
    expect(globalsCss).toMatch(/--ui-surface-modal-body:\s*color-mix/);
    expect(globalsCss).toMatch(/--ui-panel-orb:/);
    expect(globalsCss).toMatch(/--ui-status-running:/);
    expect(globalsCss).toMatch(/--ui-workflow-status-done:/);
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

  it('keeps task dispatch bottom controls on shared layout and color aliases', () => {
    const innerRule = globalsCss.match(/\.task-dispatch-bottom-inner\s*\{([^}]*)\}/);
    const pickerRule = globalsCss.match(/\.task-dispatch-bottom-picker\s*\{([^}]*)\}/);
    const promptTriggerRule = globalsCss.match(
      /\.task-dispatch-bottom-prompt-trigger\s*\{([^}]*)\}/,
    );
    const promptPopoverRule = globalsCss.match(
      /\.task-dispatch-bottom-prompt-popover\s*\{([^}]*)\}/,
    );
    const mobileInnerRule = globalsCss.match(
      /\.task-dispatch-bottom-inner\s*\{\s*grid-template-areas:\s*'engine model target mode'\s*'prompt send send send';([^}]*)\}/,
    );

    expect(innerRule?.[1]).toContain(
      '--task-dispatch-control-border: color-mix(in srgb, var(--ui-border), transparent 14%);',
    );
    expect(innerRule?.[1]).toContain(
      '--task-dispatch-control-bg: color-mix(in srgb, var(--ui-surface-strong), transparent 16%);',
    );
    expect(innerRule?.[1]).toContain(
      '--task-dispatch-popover-border: color-mix(in srgb, var(--ui-border), transparent 12%);',
    );
    expect(pickerRule?.[1]).toMatch(/border:\s*1px solid\s*var\(--task-dispatch-control-border/);
    expect(pickerRule?.[1]).toMatch(/background:\s*var\(\s*--task-dispatch-control-bg/);
    expect(promptTriggerRule?.[1]).toContain('width: 2.75rem;');
    expect(promptTriggerRule?.[1]).toMatch(
      /border:\s*1px solid\s*var\(--task-dispatch-control-border/,
    );
    expect(promptTriggerRule?.[1]).toMatch(/background:\s*var\(\s*--task-dispatch-control-bg/);
    expect(promptPopoverRule?.[1]).toMatch(
      /border:\s*1px solid\s*var\(--task-dispatch-popover-border/,
    );
    expect(mobileInnerRule?.[1]).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(mobileInnerRule?.[1]).not.toContain('2.75rem repeat');
  });

  it('keeps task dispatch send shortcut overlays on accent foreground tokens', () => {
    const shortcutRule = globalsCss.match(/\.task-dispatch-send-shortcut\s*\{([^}]*)\}/);

    expect(shortcutRule?.[1]).toContain(
      'background: color-mix(in srgb, var(--ui-on-accent), transparent 82%);',
    );
    expect(shortcutRule?.[1]).not.toContain('var(--ui-text)');
  });

  it('moves the global error page onto app tokens instead of a file-local palette', () => {
    expect(globalErrorSource).toContain('route-state-page');
    expect(globalErrorSource).toContain('route-state-card');
    expect(globalErrorSource).toContain('route-state-primary-action');
    expect(globalsCss).toContain('.route-state-global-page');
    expect(globalsCss).toContain('var(--ui-surface');
    expect(globalsCss).toContain('var(--ui-text');
    expect(globalsCss).toContain('var(--ui-border');
    expect(globalErrorSource).not.toContain("background: '#0b1220'");
    expect(globalErrorSource).not.toContain("color: '#e8effa'");
  });

  it('reuses shared ui tokens across panels, project surfaces, and kanban card chrome', () => {
    expect(panelsCss).toContain('var(--ui-panel-orb)');
    expect(panelsCss).toContain('blur(var(--ui-panel-blur))');
    expect(panelsCss).toContain('background: var(--ui-surface-panel);');
    expect(panelsCss).toContain('box-shadow: var(--ui-elevation-2);');
    expect(projectsCss).toContain('var(--ui-surface-panel)');
    expect(projectsCss).toContain('var(--ui-surface-muted)');
    expect(projectsCss).toContain('var(--ui-surface-elevated)');
    expect(projectsCss).not.toContain('#112136');
    expect(projectsCss).not.toMatch(/color-mix\(in srgb,[^;]*(?:\bblack\b|\bwhite\b)/);
    expect(cardsCss).toContain('var(--ui-surface-elevated)');
    expect(cardsCss).toContain('var(--ui-surface-elevated-strong)');
    expect(cardsCss).toContain('var(--ui-status-running)');
    expect(cardsCss).toContain('var(--ui-status-queued)');
    expect(cardsCss).toMatch(/\.projectBoardCard\s*\{[\s\S]*background:\s*var\(--ui-card-bg\);/);
  });

  it('renders project detail status and metric chrome with shared ui tokens', () => {
    const dom = renderCssFixture(
      `
        <section data-testid="detail-hero" class="detailHero">
          <span data-testid="detail-status-default" class="detailStatusDot"></span>
          <span
            data-testid="detail-status-live"
            class="detailStatusDot"
            data-project-status-tone="live"
          ></span>
          <span
            data-testid="detail-status-queued"
            class="detailStatusDot"
            data-project-status-tone="queued"
          ></span>
          <span
            data-testid="detail-status-at-risk"
            class="detailStatusDot"
            data-project-status-tone="at-risk"
          ></span>
          <article data-testid="detail-metric" class="detailMetric"></article>
        </section>
      `,
      'light',
      [projectDetailCss],
    );

    expectComputedProperties(dom, 'detail-status-default', {
      '--project-detail-status-color': 'var(--ui-success)',
      '--project-detail-status-glow': 'var(--ui-success-soft)',
    });
    expectComputedProperties(dom, 'detail-status-live', {
      '--project-detail-status-color': 'var(--ui-status-running)',
      '--project-detail-status-glow': 'var(--ui-status-running-glow)',
    });
    expectComputedProperties(dom, 'detail-status-queued', {
      '--project-detail-status-color': 'var(--ui-status-queued)',
      '--project-detail-status-glow': 'var(--ui-status-queued-border)',
    });
    expectComputedProperties(dom, 'detail-status-at-risk', {
      '--project-detail-status-color': 'var(--ui-warning)',
      '--project-detail-status-glow': 'var(--ui-warning-soft)',
    });
    expectComputedProperties(dom, 'detail-metric', {
      background: 'var(--ui-surface-elevated)',
      'box-shadow': 'var(--ui-elevation-1)',
    });
  });

  it('defines shared settings and admin panel tokens for management surfaces', () => {
    for (const token of [
      '--ui-admin-surface',
      '--ui-admin-surface-strong',
      '--ui-admin-border',
      '--ui-admin-divider',
      '--ui-admin-control-surface',
      '--ui-admin-control-hover-surface',
      '--ui-admin-control-accent-surface',
      '--ui-admin-status-success-surface',
      '--ui-admin-status-neutral-surface',
    ]) {
      expect(globalsCss).toContain(`${token}:`);
    }
  });

  it('renders settings, telegram, labels, and form panel fixtures on shared admin tokens', () => {
    const settingsDom = renderCssFixture(
      `
        <section data-testid="settings-section" class="section"></section>
        <div data-testid="label-row" class="labelRow"></div>
        <button data-testid="label-color-button" class="labelColorButton"></button>
        <div data-testid="label-color-picker" class="labelColorPicker"></div>
      `,
      'light',
      [settingsPageCss],
    );
    const telegramDom = renderCssFixture(
      `
        <button data-testid="channel-tab" class="channelTab"></button>
        <button data-testid="active-channel-tab" class="channelTab" data-active="true"></button>
        <span data-testid="neutral-channel-status" class="channelStatus"></span>
        <span
          data-testid="positive-channel-status"
          class="channelStatus"
          data-tone="positive"
        ></span>
        <section data-testid="channel-panel" class="channelPanel"></section>
        <div data-testid="channel-hint" class="channelHint"></div>
      `,
      'light',
      [telegramSettingsCss],
    );
    const controlsDom = renderCssFixture(
      `
        <form data-testid="panel-form" class="panelForm"></form>
        <section data-testid="panel-summary" class="panelSummary"></section>
        <code data-testid="panel-code" class="panelCode"></code>
        <button data-testid="color-trigger" class="colorTrigger"></button>
        <div data-testid="color-popover" class="colorPopover"></div>
      `,
      'light',
      [settingsControlsCss],
    );
    const taskFormDom = renderCssFixture(
      `
        <section data-testid="setup-section" class="setupSection"></section>
        <section data-testid="notes-section" class="notesSection"></section>
        <section data-testid="meta-section" class="metaSection"></section>
      `,
      'light',
      [taskFormPanelCss],
    );

    expectComputedProperties(settingsDom, 'settings-section', {
      background: 'var(--ui-admin-surface)',
      'box-shadow': 'none',
    });
    expectComputedProperties(settingsDom, 'label-row', {
      background: 'var(--ui-admin-label-tile-surface)',
    });
    expectComputedProperties(settingsDom, 'label-color-button', {
      background: 'var(--ui-admin-control-surface)',
    });
    expectComputedProperties(settingsDom, 'label-color-picker', {
      background: 'var(--ui-admin-surface-strong)',
    });

    expectComputedProperties(telegramDom, 'channel-tab', {
      background: 'var(--ui-admin-control-surface)',
    });
    expectComputedProperties(telegramDom, 'active-channel-tab', {
      background: 'var(--ui-admin-control-accent-surface)',
    });
    expectComputedProperties(telegramDom, 'neutral-channel-status', {
      background: 'var(--ui-admin-status-neutral-surface)',
      color: 'var(--ui-admin-status-neutral-text)',
    });
    expectComputedProperties(telegramDom, 'positive-channel-status', {
      background: 'var(--ui-admin-status-success-surface)',
      color: 'var(--ui-admin-status-success-text)',
    });
    expectComputedProperties(telegramDom, 'channel-panel', {
      background: 'var(--ui-admin-surface-muted)',
    });
    expectComputedProperties(telegramDom, 'channel-hint', {
      background: 'var(--ui-admin-control-surface)',
    });

    expectComputedProperties(controlsDom, 'panel-form', {
      'min-width': '0px',
    });
    expectComputedProperties(controlsDom, 'panel-summary', {
      background: 'var(--ui-admin-control-surface)',
      'box-shadow': 'var(--ui-elevation-0)',
    });
    expectComputedProperties(controlsDom, 'panel-code', {
      background: 'var(--ui-admin-control-surface)',
      color: 'var(--ui-text)',
    });
    expectComputedProperties(controlsDom, 'color-trigger', {
      background: 'var(--ui-admin-control-surface)',
    });
    expectComputedProperties(controlsDom, 'color-popover', {
      background: 'var(--ui-admin-surface-strong)',
    });

    for (const testId of ['setup-section', 'notes-section', 'meta-section']) {
      expectComputedProperties(taskFormDom, testId, {
        background: 'var(--ui-admin-surface)',
        'min-width': '0px',
      });
    }
  });

  it('renders task panel and QA modals on the shared modal shell tokens', () => {
    const taskPanelDom = renderCssFixture(
      `
        <section data-testid="task-panel-content" class="content">
          <header data-testid="task-panel-header" class="header"></header>
          <div data-testid="task-panel-body" class="body"></div>
        </section>
      `,
      'light',
      [taskPanelModalCss],
    );
    const readyQaDom = renderCssFixture(
      `
        <section data-testid="ready-qa-content" class="qaModalContent">
          <header data-testid="ready-qa-header" class="qaModalHeader"></header>
          <div data-testid="ready-qa-body" class="qaModalBody"></div>
        </section>
      `,
      'light',
      [readyQaActionsCss],
    );

    for (const [dom, prefix] of [
      [taskPanelDom, 'task-panel'],
      [readyQaDom, 'ready-qa'],
    ] as const) {
      expectComputedProperties(dom, `${prefix}-content`, {
        background: 'var(--ui-surface-modal)',
        'box-shadow': 'var(--ui-elevation-3)',
      });
      expectComputedProperties(dom, `${prefix}-header`, {
        background: 'var(--ui-surface-modal-header)',
      });
      expectComputedProperties(dom, `${prefix}-body`, {
        background: 'var(--ui-surface-modal-body)',
      });
    }
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
