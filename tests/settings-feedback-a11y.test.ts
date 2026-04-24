import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const labelFormSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/settings-label-form.tsx'),
  'utf8',
);
const settingsPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/settings/page.tsx'),
  'utf8',
);
const projectPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/(workspace)/(main)/project/[key]/page.tsx'),
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
const kitchenSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/kitchen-mode-settings.tsx'),
  'utf8',
);
const telegramSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/telegram-settings.tsx'),
  'utf8',
);

describe('settings feedback accessibility fixes', () => {
  it('adds inline accessible feedback for label forms instead of toast-only errors', () => {
    expect(labelFormSource).toContain('useId');
    expect(labelFormSource).toContain('SettingStatusMessage');
    expect(labelFormSource).toContain('SettingsLabelFormStateContext');
    expect(labelFormSource).toContain('SettingsLabelNameInput');
    expect(labelFormSource).toContain('formState?.nameError ? formState.feedbackId : undefined');
    expect(labelFormSource).toContain('formState?.colorError ? formState.feedbackId : undefined');
    expect(projectLabelsPanelSource).toContain('SettingsLabelNameInput');
    expect(projectLabelsPanelSource).toContain('<TaskLabelColorField');
    expect(projectPageSource).toContain("field: 'name'");
    expect(projectPageSource).toContain("field: 'color'");
  });

  it('uses the shared status message component across mutable settings controls', () => {
    expect(timezoneSource).toContain('SettingStatusMessage');
    expect(kitchenSource).toContain('SettingStatusMessage');
    expect(telegramSource).toContain('SettingStatusMessage');
  });

  it('drops the removed engine preset settings section from the settings page', () => {
    expect(settingsPageSource).not.toContain('EnginePresetSettings');
    expect(settingsPageSource).not.toContain('Engine Presets');
    expect(settingsPageSource).not.toContain('engine_inbox');
    expect(settingsPageSource).not.toContain('engine_todo');
    expect(settingsPageSource).not.toContain('engine_hold');
    expect(settingsPageSource).not.toContain('engine_ready');
    expect(settingsPageSource).not.toContain('engine_done');
  });

  it('restores save-on-change controls to the last persisted value after a failed patch', () => {
    expect(timezoneSource).toContain('setValue(previousValue)');
    expect(kitchenSource).toContain('setEnabled(previousValue)');
  });
});
