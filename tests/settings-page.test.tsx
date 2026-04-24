import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  getOwnerUserOrNull: vi.fn(),
  requireOwnerUser: vi.fn(),
  getUserSettings: vi.fn(),
  setUserSetting: vi.fn(),
  writeAuditLog: vi.fn(),
  encryptTelegramToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('@/app/components/kitchen-mode-settings', () => ({
  KitchenModeSettings: () => <div>Kitchen mode</div>,
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/components/panels.module.css', () => ({
  default: {
    heroPanel: 'heroPanel',
    sectionPanel: 'sectionPanel',
  },
}));

vi.mock('@/app/components/telegram-settings', () => ({
  TelegramSettings: () => <div>Telegram settings</div>,
}));

vi.mock('@/app/components/timezone-settings', () => ({
  TimezoneSettings: ({ defaultValue }: { defaultValue: string }) => (
    <div data-slot="timezone-settings">{defaultValue}</div>
  ),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({}),
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/task-meta', () => ({
  normalizeTaskLabelColor: vi.fn((value: string) => value),
  parseTaskLabelColor: vi.fn((value: string) => value || null),
  parseTaskPriority: vi.fn((value: string) => value || 'none'),
  TASK_PRIORITIES: ['low', 'high'],
  TASK_PRIORITY_LABEL: {
    low: 'Low',
    high: 'High',
    none: 'No priority',
  },
  TASK_PRIORITY_COLOR: {
    low: '#40c057',
    high: '#fd7e14',
    none: null,
  },
}));

vi.mock('@/lib/telegram-crypto', () => ({
  encryptTelegramToken: mocked.encryptTelegramToken,
}));

vi.mock('@/lib/terminology', () => ({
  resolveTerminology: vi.fn(() => ({
    task: {
      singular: 'Task',
      singularLower: 'task',
      pluralLower: 'tasks',
    },
  })),
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    ENGINE_QA: 'engine_qa',
    TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
    TELEGRAM_CHAT_ID: 'telegram_chat_id',
    TELEGRAM_ENABLED: 'telegram_enabled',
    TIMEZONE: 'timezone',
  },
  getUserSettings: mocked.getUserSettings,
  setUserSetting: mocked.setUserSetting,
}));

import SettingsPage from '@/app/(workspace)/(main)/settings/page';

async function renderSettingsPage() {
  const page = await SettingsPage();
  return renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);
}

describe('app/(workspace)/(main)/settings/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSettings.mockResolvedValue({
      kitchen_mode: 'false',
      telegram_bot_token: '',
      telegram_chat_id: '',
      telegram_enabled: 'false',
      timezone: 'America/Toronto',
    });
  });

  it('does not render the removed labels section in workspace settings', async () => {
    const html = await renderSettingsPage();

    expect(html).toContain('data-settings-style="desk"');
    expect(html).not.toContain('Labels');
    expect(html).not.toContain('Create label');
    expect(html).not.toContain('Manage labels');
  });

  it('renders timezone controls alongside the rest of workspace settings', async () => {
    const html = await renderSettingsPage();

    expect(html).toContain('Timezone');
    expect(html).toContain('Save the IANA timezone used for dates, timestamps, and today logic.');
    expect(html).toContain('data-slot="timezone-settings"');
    expect(html).toContain('America/Toronto');
  });

  it('consolidates workspace preferences into one shared settings section', async () => {
    const html = await renderSettingsPage();

    expect(html).toContain('Workspace Preferences');
    expect(html).toContain('data-settings-group="workspace-preferences"');
    expect(html).toContain('data-settings-item="kitchen-mode"');
    expect(html).toContain('data-settings-item="timezone"');
  });

  it('does not render the removed live sync preference', async () => {
    const html = await renderSettingsPage();

    expect(html).not.toContain('data-settings-item="live-sync"');
    expect(html).not.toContain('Live Sync');
  });

  it('does not render the removed engine preset section', async () => {
    const html = await renderSettingsPage();

    expect(html).not.toContain('Engine Presets');
  });

  it('keeps the settings hero focused on settings content without a connections shortcut', async () => {
    const html = await renderSettingsPage();

    expect(html).not.toContain('href="/connections"');
    expect(html).not.toContain('Open Connections');
    expect(html).not.toContain('Open API Keys');
    expect(html).not.toContain('heroPanel');
  });

  it('renders the page title as natural page chrome instead of a dedicated panel', async () => {
    const html = await renderSettingsPage();

    expect(html).toContain('data-workspace-page-header="true"');
    expect(html).toMatch(/<h1[^>]*>Task Settings<\/h1>/);
    expect(html).toContain('Task Settings');
    expect(html).toContain('Manage workspace preferences and task priority symbols.');
    expect((html.match(/mantine-Paper-root/g) ?? []).length).toBe(3);
    expect(html.indexOf('Task Settings')).toBeLessThan(html.indexOf('Priority Icons'));
  });
});
