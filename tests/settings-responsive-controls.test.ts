import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const settingsControlsCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/settings-controls.module.css'),
  'utf8',
);
const settingsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/settings/page.tsx'),
  'utf8',
);
const projectLabelsPanelSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/panels/project-labels-panel.tsx'),
  'utf8',
);
const timezoneSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/timezone-settings.tsx'),
  'utf8',
);

describe('settings responsive control fixes', () => {
  it('defines shared touch-friendly settings control sizes', () => {
    expect(settingsControlsCss).toContain('--button-height: var(--ui-hit-touch-min);');
    expect(settingsControlsCss).toContain('--input-height: var(--ui-hit-touch-min);');
    expect(settingsControlsCss).toContain('min-height: var(--ui-hit-touch-min);');
    expect(settingsControlsCss).toContain('--psi-button-size: var(--ui-hit-touch-min);');
  });

  it('provides responsive full-width control helpers for narrow screens', () => {
    expect(settingsControlsCss).toContain('width: 100%;');
    expect(settingsControlsCss).toMatch(/@media \(max-width: 36rem\)/);
  });

  it('removes the fixed inline minWidth settings that caused mobile overflow risk', () => {
    expect(timezoneSource).not.toContain('minWidth: 280');
  });

  it('stops using compact delete controls in settings label rows', () => {
    expect(settingsPageSource).not.toContain('size="compact-sm"');
  });

  it('routes project label deletion through the shared confirm-action flow', () => {
    expect(projectLabelsPanelSource).toContain('ConfirmActionButton');
    expect(projectLabelsPanelSource).toContain('formId={deleteFormId}');
  });

  it('adds a dedicated danger block and mobile-safe stacking for project label rows', () => {
    expect(settingsControlsCss).toContain('.touchButton');
    expect(projectLabelsPanelSource).not.toContain('labelRowSecondaryActions');
    expect(projectLabelsPanelSource).toContain('labelRowDanger');
    expect(projectLabelsPanelSource).toContain('labelRowMeta');
    expect(
      fs.readFileSync(
        path.join(process.cwd(), 'app/(workspace)/(main)/settings/settings-page.module.css'),
        'utf8',
      ),
    ).toMatch(/@media \(max-width: 62rem\)[\s\S]*\.labelRowDanger[\s\S]*width: 100%;/);
  });
});
