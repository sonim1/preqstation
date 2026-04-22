import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  redirect: vi.fn(),
  getOwnerUserOrNull: vi.fn(),
  listOwnerBrowserSessions: vi.fn(),
  listOwnerMcpConnections: vi.fn(),
  getUserSetting: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('@tabler/icons-react', () => ({
  IconPlugConnected: () => null,
  IconLayoutGrid: () => null,
  IconCircleCheck: () => null,
  IconClockExclamation: () => null,
  IconAlertSquareRounded: () => null,
}));

vi.mock('@/app/(workspace)/(main)/connections/connections-confirm-actions', () => ({
  ConnectionsConfirmActionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  ConnectionsConfirmActionButton: ({
    children,
    className,
    'aria-label': ariaLabel,
    style,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    'aria-label'?: string;
    style?: React.CSSProperties;
    variant?: string;
  }) => (
    <button className={className} aria-label={ariaLabel} data-variant={variant} style={style}>
      {children}
    </button>
  ),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({
    title,
    description,
    className,
    iconClassName,
  }: {
    title: string;
    description?: string;
    className?: string;
    iconClassName?: string;
  }) => (
    <div data-slot="empty-state" className={className} data-icon-class-name={iconClassName}>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('@/app/components/panels.module.css', () => ({
  default: {
    heroPanel: 'heroPanel',
    sectionPanel: 'sectionPanel',
  },
}));

vi.mock('@/app/(workspace)/(main)/connections/connections-page.module.css', () => ({
  default: {
    pageHeader: 'pageHeader',
    pageSection: 'pageSection',
    sectionHeader: 'sectionHeader',
    sectionEyebrow: 'sectionEyebrow',
    summaryRail: 'summaryRail',
    summaryHeadline: 'summaryHeadline',
    summaryHeadlineHealthy: 'summaryHeadlineHealthy',
    summaryHeadlineWarning: 'summaryHeadlineWarning',
    summaryHeadlineAttention: 'summaryHeadlineAttention',
    summaryMeta: 'summaryMeta',
    mutedText: 'mutedText',
    sectionEmptyState: 'sectionEmptyState',
    emptyStateIcon: 'emptyStateIcon',
    tableShells: 'tableShells',
    tableShell: 'tableShell',
    tableShellHeader: 'tableShellHeader',
    tableShellLabel: 'tableShellLabel',
    tableScroller: 'tableScroller',
    tableCaption: 'tableCaption',
    dataTable: 'dataTable',
    dataRow: 'dataRow',
    dataCellPrimary: 'dataCellPrimary',
    dataCellTitle: 'dataCellTitle',
    dataCellLabel: 'dataCellLabel',
    dataCellMeta: 'dataCellMeta',
    dataCellStack: 'dataCellStack',
    dataRowHeader: 'dataRowHeader',
    contextCell: 'contextCell',
    statusCell: 'statusCell',
    actionCell: 'actionCell',
    actionGroup: 'actionGroup',
    actionButton: 'actionButton',
  },
}));

vi.mock('@/app/(workspace)/(main)/connections/actions', () => ({
  revokeBrowserSessionAction: vi.fn(),
  revokeConnectionAction: vi.fn(),
}));

vi.mock('@/lib/mcp/connections', () => ({
  listOwnerMcpConnections: mocked.listOwnerMcpConnections,
}));

vi.mock('@/lib/browser-sessions', () => ({
  listOwnerBrowserSessions: mocked.listOwnerBrowserSessions,
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

import ConnectionsPage from '@/app/(workspace)/(main)/connections/page';

async function renderConnectionsPage() {
  const page = await ConnectionsPage();
  return renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);
}

describe('app/(workspace)/(main)/connections/page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'));
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.listOwnerBrowserSessions.mockResolvedValue([]);
    mocked.listOwnerMcpConnections.mockResolvedValue([]);
    mocked.getUserSetting.mockResolvedValue('UTC');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an empty state when no MCP clients are connected yet', async () => {
    const html = await renderConnectionsPage();

    expect(html).toContain('Connections');
    expect(html).toContain('No connections yet');
    expect(html).toContain(
      'Finish OAuth in an agent and it will appear here with its status, last use, and expiry.',
    );
    expect(html).toContain('class="sectionEmptyState"');
    expect(html.match(/data-icon-class-name="emptyStateIcon"/g) ?? []).toHaveLength(2);
  });

  it('renders owner-visible connection metadata without exposing any token values', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-30T12:00:00.000Z'),
        expiresAt: new Date('2026-04-15T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Codex');
    expect(html).toContain('Active');
    expect(html).toContain('127.0.0.1:3456/callback');
    expect(html).not.toContain('http://127.0.0.1:3456/callback');
    expect(html).toContain('Connected');
    expect(html).toContain('Last used');
    expect(html).toContain('Expires');
    expect(html).not.toContain('preq_');
  });

  it('hides revoked client connections and browser sessions from the connections page', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'active-connection',
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
      {
        id: 'revoked-connection',
        clientId: 'client-2',
        displayName: 'Revoked Claude bridge',
        redirectUri: 'http://127.0.0.1:4567/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T09:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-19T12:00:00.000Z'),
        client: {
          clientName: 'Revoked Claude bridge',
        },
      },
    ]);
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'active-browser-session',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T10:30:00.000Z'),
      },
      {
        id: 'revoked-browser-session',
        ownerId: 'owner-1',
        ipAddress: '198.51.100.20',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Revoked Chrome',
        osName: 'Windows',
        lastUsedAt: new Date('2026-03-25T09:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-19T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Codex');
    expect(html).toContain('Chrome');
    expect(html).toContain('1 total');
    expect(html).not.toContain('Revoked Claude bridge');
    expect(html).not.toContain('Revoked Chrome');
    expect(html).not.toContain('198.51.100.20');
    expect(html).not.toContain('Restore');
  });

  it('renders the page as a single editorial flow instead of stacked card panels', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-30T12:00:00.000Z'),
        expiresAt: new Date('2026-04-15T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).not.toContain('heroPanel');
    expect(html).not.toContain('sectionPanel');
    expect(html).not.toContain('data-with-border="true"');
  });

  it('uses page-specific row styling instead of Mantine default striped and hover states', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-30T12:00:00.000Z'),
        expiresAt: new Date('2026-04-15T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).not.toContain('data-striped="odd"');
    expect(html).not.toContain('data-hover="true"');
  });

  it('surfaces a distilled summary rail with total text instead of status chips', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'healthy-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-24T08:30:00.000Z'),
        expiresAt: new Date('2026-04-20T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-01T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
      {
        id: 'soon-1',
        clientId: 'client-2',
        displayName: 'Dispatch bridge',
        redirectUri: 'http://127.0.0.1:4567/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-24T09:30:00.000Z'),
        expiresAt: new Date('2026-03-27T11:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-02T12:00:00.000Z'),
        client: {
          clientName: 'Dispatch bridge',
        },
      },
      {
        id: 'expired-1',
        clientId: 'client-3',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:5678/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-24T10:30:00.000Z'),
        expiresAt: new Date('2026-03-25T11:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-03T12:00:00.000Z'),
        client: {
          clientName: 'Claude desktop bridge',
        },
      },
      {
        id: 'revoked-1',
        clientId: 'client-4',
        displayName: 'Gemini desktop bridge',
        redirectUri: 'http://127.0.0.1:6789/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-24T11:30:00.000Z'),
        expiresAt: new Date('2026-04-03T12:00:00.000Z'),
        revokedAt: new Date('2026-03-24T12:00:00.000Z'),
        createdAt: new Date('2026-03-04T12:00:00.000Z'),
        client: {
          clientName: 'Gemini desktop bridge',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('1 connection needs attention');
    expect(html).toContain('3 total');
    expect(html).not.toContain('Gemini desktop bridge');
    expect(html).not.toContain('summaryChip');
  });

  it('uses table-first summary copy and natural singular grammar', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'soon-1',
        clientId: 'client-1',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:4567/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-24T09:30:00.000Z'),
        expiresAt: new Date('2026-03-27T11:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-02T12:00:00.000Z'),
        client: {
          clientName: 'Claude desktop bridge',
        },
      },
    ]);
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'browser-session-1',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Review client access and browser sign-ins in two focused tables.');
    expect(html).toContain('1 connection expires soon');
    expect(html).toContain('No browser sessions yet');
    expect(html).not.toContain('1 browser session needs attention');
    expect(html).not.toContain(
      'OAuth-backed client access with live status, usage, and expiry details.',
    );
    expect(html).not.toContain(
      'Browser sign-ins stay separate from agent connections so revocations are easier to scan.',
    );
    expect(html).not.toContain('grouped by what needs attention first');
  });

  it('formats timestamps in the saved timezone and shows precise expiry details', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'codex',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-25T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Codex',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('2026-03-20 12:00');
    expect(html).toContain('2026-03-25 10:30');
    expect(html).toContain('3h 45m');
    expect(html).toContain('2026-03-25 15:45');
  });

  it('falls back to inferred engine labels when the stored engine is missing', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'OpenAI desktop bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'OpenAI desktop bridge',
        },
      },
      {
        id: 'connection-2',
        clientId: 'client-2',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:4567/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Claude desktop bridge',
        },
      },
      {
        id: 'connection-3',
        clientId: 'client-3',
        displayName: 'Dispatch bridge',
        redirectUri: 'http://127.0.0.1:5678/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Dispatch bridge',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Codex');
    expect(html).toContain('Claude Code');
    expect(html).toContain('Unknown');
    expect(html).toContain('Connected');
    expect(html).toContain('Last used');
  });

  it('renders client connections inside a focused table shell instead of grouped list sections', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'attention-1',
        clientId: 'client-1',
        displayName: 'Dispatch bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-25T10:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Dispatch bridge',
        },
      },
      {
        id: 'soon-1',
        clientId: 'client-2',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:4567/callback',
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
        id: 'healthy-1',
        clientId: 'client-3',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:5678/callback',
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

    const html = await renderConnectionsPage();

    expect(html).toContain('class="tableShell"');
    expect(html).toContain('class="tableScroller"');
    expect(html).toContain('<table');
    expect(html).toContain('Connection');
    expect(html).toContain('Context');
    expect(html).toContain('Status');
    expect(html).toContain('Action');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('Client Connections');
    expect(html).not.toContain('Owner Sign-ins');
    expect(html).not.toContain('connections-group-needs-attention');
    expect(html).toContain('aria-label="Revoke Codex connection"');
  });

  it('names the connections section with the visible section heading', async () => {
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

    const html = await renderConnectionsPage();

    expect(html).toContain('aria-labelledby="connections-clients-heading"');
    expect(html).toMatch(/<h2[^>]*id="connections-clients-heading"[^>]*>Connected Clients<\/h2>/);
  });

  it('uses semantic heading and table markup for connections and browser sessions', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'attention-1',
        clientId: 'client-1',
        displayName: 'Dispatch bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-25T10:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Dispatch bridge',
        },
      },
      {
        id: 'healthy-1',
        clientId: 'client-3',
        displayName: 'Codex',
        redirectUri: 'http://127.0.0.1:5678/callback',
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
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'browser-session-1',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T10:30:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toMatch(/<h2[^>]*id="connections-clients-heading"[^>]*>Connected Clients<\/h2>/);
    expect(html).toMatch(
      /<h2[^>]*id="connections-browser-sessions-heading"[^>]*>Browser Sessions<\/h2>/,
    );
    expect(html.match(/<table/g)).toHaveLength(2);
    expect(html).toContain('Client connections with status, context, expiry, and access actions.');
    expect(html).toContain(
      'Browser sessions with status, device context, expiry, and access actions.',
    );
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html.match(/scope="row"/g)).toHaveLength(3);
    expect(html.match(/dataCellLabel/g)).toHaveLength(6);
    expect(html).not.toContain('role="listitem"');
  });

  it('applies token-based styles to status badges and revoke actions', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Claude desktop bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: null,
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-25T10:00:00.000Z'),
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

    const html = await renderConnectionsPage();

    expect(html).toContain('--badge-bg:var(--ui-warning-soft)');
    expect(html).toContain('--badge-color:var(--ui-warning)');
    expect(html).toContain('--badge-bg:var(--ui-neutral-soft)');
    expect(html).toContain('--badge-color:var(--ui-neutral-strong)');
    expect(html).toContain('--button-bg:var(--ui-danger-soft)');
    expect(html).toContain('--button-color:var(--ui-danger)');
    expect(html).not.toContain('var(--mantine-color-dimmed)');
  });

  it('does not opt tokenized status badges or revoke actions into Mantine light variants', async () => {
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

    const html = await renderConnectionsPage();

    expect(html).not.toContain('data-variant="light"');
  });

  it('hides revoked connection rows instead of offering restore', async () => {
    mocked.listOwnerMcpConnections.mockResolvedValueOnce([
      {
        id: 'connection-1',
        clientId: 'client-1',
        displayName: 'Gemini desktop bridge',
        redirectUri: 'http://127.0.0.1:3456/callback',
        engine: 'gemini-cli',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        client: {
          clientName: 'Gemini desktop bridge',
        },
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('No connections yet');
    expect(html).not.toContain('Gemini desktop bridge');
    expect(html).not.toContain('Restore');
  });

  it('renders a dedicated browser sessions section with device and IP metadata', async () => {
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'browser-session-1',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T10:30:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Browser Sessions');
    expect(html).toContain('aria-labelledby="connections-browser-sessions-heading"');
    expect(html).toContain('203.0.113.10');
    expect(html).toContain('Chrome');
    expect(html).toContain('macOS');
    expect(html).toContain('2026-03-20 12:00');
    expect(html).toContain('2026-03-25 10:30');
    expect(html).toContain('5d 3h');
    expect(html).toContain('aria-label="Revoke browser session from 203.0.113.10"');
  });

  it('renders browser sessions in their own table shell and uses human fallback copy', async () => {
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'browser-session-1',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T10:30:00.000Z'),
      },
      {
        id: 'browser-session-2',
        ownerId: 'owner-1',
        ipAddress: null,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: null,
        osName: null,
        lastUsedAt: new Date('2026-03-25T09:30:00.000Z'),
        expiresAt: new Date('2026-03-27T11:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-21T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T09:30:00.000Z'),
      },
      {
        id: 'browser-session-3',
        ownerId: 'owner-1',
        ipAddress: '198.51.100.20',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'Windows',
        lastUsedAt: new Date('2026-03-25T08:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-22T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('1 browser session expires soon');
    expect(html).toContain('2 total');
    expect(html).toContain('Browser Sessions');
    expect(html).toContain('Session');
    expect(html).toContain('Browser not detected');
    expect(html).toContain('OS not detected');
    expect(html).toContain('IP unavailable');
    expect(html).not.toContain('198.51.100.20');
    expect(html).not.toContain('Windows');
  });

  it('hides already revoked browser session rows', async () => {
    mocked.listOwnerBrowserSessions.mockResolvedValueOnce([
      {
        id: 'browser-session-1',
        ownerId: 'owner-1',
        ipAddress: '203.0.113.10',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        browserName: 'Chrome',
        osName: 'macOS',
        lastUsedAt: new Date('2026-03-25T10:30:00.000Z'),
        expiresAt: new Date('2026-03-30T15:45:00.000Z'),
        revokedAt: new Date('2026-03-25T11:00:00.000Z'),
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
        updatedAt: new Date('2026-03-25T11:00:00.000Z'),
      },
    ]);

    const html = await renderConnectionsPage();

    expect(html).toContain('Browser Sessions');
    expect(html).toContain('No browser sessions yet');
    expect(html).not.toContain('Revoked');
    expect(html).not.toContain('203.0.113.10');
  });
});
