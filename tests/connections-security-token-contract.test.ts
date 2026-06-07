// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiKeyCreateForm } from '@/app/(workspace)/(main)/api-keys/api-key-create-form';
import apiKeyFormStyles from '@/app/(workspace)/(main)/api-keys/api-key-create-form.module.css';
import {
  ConnectionsConfirmActionButton,
  ConnectionsConfirmActionProvider,
} from '@/app/(workspace)/(main)/connections/connections-confirm-actions';
import connectionStyles from '@/app/(workspace)/(main)/connections/connections-page.module.css';
import ConnectionsPage from '@/app/(workspace)/(main)/connections/page';

const mocked = vi.hoisted(() => ({
  createApiKeyAction: vi.fn(),
  getOwnerUserOrNull: vi.fn(),
  getUserSetting: vi.fn(),
  listOwnerBrowserSessions: vi.fn(),
  listOwnerMcpConnections: vi.fn(),
  redirect: vi.fn(),
  revokeAllBrowserSessionsAction: vi.fn(),
  revokeAllConnectionsAction: vi.fn(),
  revokeBrowserSessionAction: vi.fn(),
  revokeConnectionAction: vi.fn(),
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useActionState: mocked.useActionState,
  };
});

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlugConnected: () => null,
  IconTrash: () => null,
}));

vi.mock('@/app/(workspace)/(main)/api-keys/actions', () => ({
  createApiKeyAction: mocked.createApiKeyAction,
}));

vi.mock('@/app/(workspace)/(main)/connections/actions', () => ({
  revokeAllBrowserSessionsAction: mocked.revokeAllBrowserSessionsAction,
  revokeAllConnectionsAction: mocked.revokeAllConnectionsAction,
  revokeBrowserSessionAction: mocked.revokeBrowserSessionAction,
  revokeConnectionAction: mocked.revokeConnectionAction,
}));

vi.mock('@/lib/browser-sessions', () => ({
  listOwnerBrowserSessions: mocked.listOwnerBrowserSessions,
}));

vi.mock('@/lib/mcp/connections', () => ({
  listOwnerMcpConnections: mocked.listOwnerMcpConnections,
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    TIMEZONE: 'timezone',
  },
  getUserSetting: mocked.getUserSetting,
}));

function renderWithMantine(element: React.ReactElement) {
  return render(React.createElement(MantineProvider, null, element));
}

async function renderConnectionsPage() {
  const page = await ConnectionsPage({});

  return renderWithMantine(page);
}

function getBadgeRoot(label: string) {
  const labelElement = screen.getByText(label);
  const badgeRoot = labelElement.closest<HTMLElement>('.mantine-Badge-root');

  expect(badgeRoot, `Expected badge root for ${label}`).not.toBeNull();

  return badgeRoot!;
}

function getClosestClassByText(text: string, className: string) {
  const root = screen.getByText(text).closest<HTMLElement>(`.${className}`);

  expect(root, `Expected ${text} to render inside ${className}`).not.toBeNull();

  return root!;
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));
  vi.clearAllMocks();
  mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
  mocked.getUserSetting.mockResolvedValue('UTC');
  mocked.listOwnerBrowserSessions.mockResolvedValue([]);
  mocked.listOwnerMcpConnections.mockResolvedValue([]);
  mocked.useActionState.mockReturnValue([{ error: null, token: null }, mocked.createApiKeyAction]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('connections and security control token contract', () => {
  it('renders the connections table with the shared table token classes', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    const { container } = await renderConnectionsPage();
    const tableShell = container.querySelector<HTMLElement>(`.${connectionStyles.tableShell}`);
    const table = screen.getByRole('table', {
      name: 'Client connections with status, context, expiry, and access actions.',
    });
    const dataRow = screen.getAllByText('Codex')[0].closest('tr');

    expect(tableShell).not.toBeNull();
    expect(tableShell?.classList).toContain(connectionStyles.tableShell);
    expect(table.classList).toContain(connectionStyles.dataTable);
    expect(dataRow?.classList).toContain(connectionStyles.dataRow);
  });

  it('maps connection status badges and revoke actions to security token styles', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-27T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Claude desktop bridge',
        },
      },
      {
        id: 'connection-2',
        clientId: 'client-2',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:4567/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    await renderConnectionsPage();

    expect(getBadgeRoot('Expiring Soon').style.getPropertyValue('--badge-bg')).toBe(
      'var(--ui-security-warning-surface)',
    );
    expect(getBadgeRoot('Expiring Soon').style.getPropertyValue('--badge-color')).toBe(
      'var(--ui-warning)',
    );
    expect(getBadgeRoot('Active').style.getPropertyValue('--badge-bg')).toBe(
      'var(--ui-security-success-surface)',
    );
    expect(getBadgeRoot('Active').style.getPropertyValue('--badge-color')).toBe(
      'var(--ui-success)',
    );

    const revokeButton = screen.getByRole('button', { name: 'Revoke Codex connection' });

    expect(revokeButton.style.getPropertyValue('--button-bg')).toBe(
      'var(--ui-security-danger-surface)',
    );
    expect(revokeButton.style.getPropertyValue('--button-color')).toBe('var(--ui-danger)');
    expect(revokeButton.style.getPropertyValue('--button-bd')).toBe(
      '1px solid var(--ui-security-danger-border)',
    );
  });

  it('renders destructive confirmation actions with danger tokens', async () => {
    const confirmButtonProps = {
      formId: 'danger-action',
      confirmTitle: 'Confirm danger',
      confirmMessage: 'This action is destructive.',
      confirmLabel: 'Delete',
    } as React.ComponentProps<typeof ConnectionsConfirmActionButton>;

    renderWithMantine(
      React.createElement(
        ConnectionsConfirmActionProvider,
        null,
        React.createElement('form', { id: 'danger-action' }),
        React.createElement(
          ConnectionsConfirmActionButton,
          confirmButtonProps,
          'Open confirmation',
        ),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    await vi.runAllTimersAsync();

    const dialog = screen.getByRole('dialog', { name: 'Confirm danger' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete' });

    expect(confirmButton.style.getPropertyValue('--button-bg')).toBe('var(--ui-danger)');
    expect(confirmButton.style.getPropertyValue('--button-color')).toBe('var(--ui-on-danger)');
    expect(confirmButton.style.getPropertyValue('--button-bd')).toBe(
      '1px solid var(--ui-security-danger-border)',
    );
  });

  it('renders the legacy API key form on the security control hierarchy', () => {
    mocked.useActionState.mockReturnValueOnce([
      { error: 'Token names must be unique.', token: 'preq_example' },
      mocked.createApiKeyAction,
    ]);

    const { container } = renderWithMantine(React.createElement(ApiKeyCreateForm));
    const formShell = container.querySelector<HTMLElement>(`.${apiKeyFormStyles.formShell}`);
    const dangerAlert = getClosestClassByText(
      'Token names must be unique.',
      apiKeyFormStyles.securityAlert,
    );
    const successAlert = getClosestClassByText(
      'New API key (shown once)',
      apiKeyFormStyles.securityAlert,
    );
    const neutralAlert = getClosestClassByText(
      'Skill Environment Variables',
      apiKeyFormStyles.securityAlert,
    );
    const tokenDisplay = screen.getByText('preq_example');

    expect(formShell).not.toBeNull();
    expect(formShell?.classList).toContain(apiKeyFormStyles.formShell);
    expect(dangerAlert?.classList).toContain(apiKeyFormStyles.securityAlert);
    expect(dangerAlert?.classList).toContain(apiKeyFormStyles.securityAlertDanger);
    expect(successAlert?.classList).toContain(apiKeyFormStyles.securityAlert);
    expect(successAlert?.classList).toContain(apiKeyFormStyles.securityAlertSuccess);
    expect(neutralAlert?.classList).toContain(apiKeyFormStyles.securityAlert);
    expect(neutralAlert?.classList).toContain(apiKeyFormStyles.securityAlertNeutral);
    expect(tokenDisplay.classList).toContain(apiKeyFormStyles.tokenDisplay);
  });
});
