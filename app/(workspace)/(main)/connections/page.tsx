import { Badge, Container, Group, Stack, Text } from '@mantine/core';
import { IconPlugConnected } from '@tabler/icons-react';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';

import {
  ConnectionsConfirmActionButton,
  ConnectionsConfirmActionProvider,
} from '@/app/(workspace)/(main)/connections/connections-confirm-actions';
import styles from '@/app/(workspace)/(main)/connections/connections-page.module.css';
import { EmptyState } from '@/app/components/empty-state';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { listOwnerBrowserSessions } from '@/lib/browser-sessions';
import { formatDateTimeForDisplay } from '@/lib/date-time';
import { listOwnerMcpConnections } from '@/lib/mcp/connections';
import { getOwnerUserOrNull } from '@/lib/owner';
import { getUserSetting, SETTING_KEYS } from '@/lib/user-settings';

import { revokeBrowserSessionAction, revokeConnectionAction } from './actions';

const ENGINE_LABELS = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'gemini-cli': 'Gemini CLI',
} as const;
const EXPIRING_SOON_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

type ConnectionRecord = Awaited<ReturnType<typeof listOwnerMcpConnections>>[number];
type BrowserSessionRecord = Awaited<ReturnType<typeof listOwnerBrowserSessions>>[number];
type DisplayStatus = 'Active' | 'Expired' | 'Expiring Soon' | 'Revoked';

function formatTimestamp(value: Date | null, timeZone: string) {
  if (!value) return 'Never';
  return formatDateTimeForDisplay(value, timeZone);
}

function formatDuration(msRemaining: number) {
  if (msRemaining <= 0) return 'Expired';

  const totalMinutes = Math.floor(msRemaining / (60 * 1000));
  if (totalMinutes < 1) return '<1m';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function getConnectionStatusAtTime(
  connection: { revokedAt: Date | null; expiresAt: Date },
  now: number,
) {
  if (connection.revokedAt) return 'Revoked';
  if (connection.expiresAt.getTime() < now) return 'Expired';
  return 'Active';
}

function getStatusBadgeStyle(status: string): CSSProperties {
  const baseStyle = {
    '--badge-bd': '1px solid color-mix(in srgb, var(--ui-border), transparent 12%)',
  } as CSSProperties;

  if (status === 'Revoked') {
    return {
      ...baseStyle,
      '--badge-bg': 'var(--ui-danger-soft)',
      '--badge-color': 'var(--ui-danger)',
    } as CSSProperties;
  }

  if (status === 'Expired' || status === 'Expiring Soon') {
    return {
      ...baseStyle,
      '--badge-bg': 'var(--ui-warning-soft)',
      '--badge-color': 'var(--ui-warning)',
    } as CSSProperties;
  }

  return {
    ...baseStyle,
    '--badge-bg': 'var(--ui-neutral-soft)',
    '--badge-color': 'var(--ui-neutral-strong)',
  } as CSSProperties;
}

function inferEngineLabel(values: Array<string | null | undefined>) {
  const haystack = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('claude')) return ENGINE_LABELS['claude-code'];
  if (haystack.includes('gemini')) return ENGINE_LABELS['gemini-cli'];
  if (haystack.includes('codex') || haystack.includes('openai') || haystack.includes('chatgpt')) {
    return ENGINE_LABELS.codex;
  }

  return 'Unknown';
}

function getEngineLabel(connection: ConnectionRecord) {
  if (connection.engine) {
    return ENGINE_LABELS[connection.engine];
  }

  return inferEngineLabel([
    connection.displayName,
    connection.client?.clientName,
    connection.redirectUri,
  ]);
}

function isConnectionExpired(record: { revokedAt: Date | null; expiresAt: Date }, now: number) {
  return !record.revokedAt && record.expiresAt.getTime() <= now;
}

function isConnectionExpiringSoon(
  record: { revokedAt: Date | null; expiresAt: Date },
  now: number,
) {
  if (record.revokedAt) return false;

  const msRemaining = record.expiresAt.getTime() - now;
  return msRemaining > 0 && msRemaining <= EXPIRING_SOON_WINDOW_MS;
}

function getConnectionSummary(connections: ConnectionRecord[], now: number) {
  const needsAttention = connections.filter(
    (connection) => !!connection.revokedAt || isConnectionExpired(connection, now),
  ).length;
  const expiringSoon = connections.filter((connection) =>
    isConnectionExpiringSoon(connection, now),
  ).length;
  const healthy = connections.length - needsAttention - expiringSoon;

  return {
    total: connections.length,
    healthy,
    expiringSoon,
    needsAttention,
  };
}

function getSummaryHeadline(summary: ReturnType<typeof getConnectionSummary>) {
  if (summary.needsAttention > 0) {
    return summary.needsAttention === 1
      ? '1 connection needs attention'
      : `${summary.needsAttention} connections need attention`;
  }

  if (summary.expiringSoon > 0) {
    return summary.expiringSoon === 1
      ? '1 connection expires soon'
      : `${summary.expiringSoon} connections expire soon`;
  }

  return 'All connections look healthy';
}

function getSummaryHeadlineToneClassName(summary: {
  expiringSoon: number;
  needsAttention: number;
}) {
  if (summary.needsAttention > 0) return styles.summaryHeadlineAttention;
  if (summary.expiringSoon > 0) return styles.summaryHeadlineWarning;
  return styles.summaryHeadlineHealthy;
}

function getDateSortValue(value: Date | null | undefined) {
  return value ? value.getTime() : 0;
}

function getStatusPriority(status: DisplayStatus) {
  if (status === 'Revoked' || status === 'Expired') return 0;
  if (status === 'Expiring Soon') return 1;
  return 2;
}

function sortConnectionsForTable(connections: ConnectionRecord[], now: number) {
  return [...connections].sort((left, right) => {
    const statusDelta =
      getStatusPriority(getDisplayStatus(left, now)) -
      getStatusPriority(getDisplayStatus(right, now));
    if (statusDelta !== 0) return statusDelta;

    const lastUsedDelta = getDateSortValue(right.lastUsedAt) - getDateSortValue(left.lastUsedAt);
    if (lastUsedDelta !== 0) return lastUsedDelta;

    const createdDelta = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;

    return left.displayName.localeCompare(right.displayName);
  });
}

const REVOKE_ACTION_BUTTON_STYLE = {
  '--button-bg': 'var(--ui-danger-soft)',
  '--button-hover': 'color-mix(in srgb, var(--ui-danger-soft), var(--ui-surface-strong) 18%)',
  '--button-color': 'var(--ui-danger)',
  '--button-bd': '1px solid color-mix(in srgb, var(--ui-danger), var(--ui-border) 72%)',
} as CSSProperties;

function getCurrentTimeMs() {
  return Date.now();
}

function formatRedirectLabel(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    return `${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return redirectUri.replace(/^[a-z]+:\/\//i, '');
  }
}

function formatBrowserSessionValue(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function getDisplayStatus(
  record: { revokedAt: Date | null; expiresAt: Date },
  now: number,
): DisplayStatus {
  const status = getConnectionStatusAtTime(record, now);
  if (status === 'Active' && isConnectionExpiringSoon(record, now)) {
    return 'Expiring Soon';
  }

  return status as DisplayStatus;
}

function getExpiryDisplay(
  record: { revokedAt: Date | null; expiresAt: Date },
  now: number,
  timeZone: string,
) {
  if (record.revokedAt) {
    return {
      value: 'Access revoked',
      meta: formatTimestamp(record.revokedAt, timeZone),
    };
  }

  return {
    value: formatDuration(record.expiresAt.getTime() - now),
    meta: formatTimestamp(record.expiresAt, timeZone),
  };
}

function getBrowserSessionSummary(browserSessions: BrowserSessionRecord[], now: number) {
  const needsAttention = browserSessions.filter(
    (session) => !!session.revokedAt || isConnectionExpired(session, now),
  ).length;
  const expiringSoon = browserSessions.filter((session) =>
    isConnectionExpiringSoon(session, now),
  ).length;
  const active = browserSessions.length - needsAttention - expiringSoon;

  return {
    total: browserSessions.length,
    active,
    expiringSoon,
    needsAttention,
  };
}

function getBrowserSessionSummaryHeadline(summary: ReturnType<typeof getBrowserSessionSummary>) {
  if (summary.needsAttention > 0) {
    return summary.needsAttention === 1
      ? '1 browser session needs attention'
      : `${summary.needsAttention} browser sessions need attention`;
  }

  if (summary.expiringSoon > 0) {
    return summary.expiringSoon === 1
      ? '1 browser session expires soon'
      : `${summary.expiringSoon} browser sessions expire soon`;
  }

  return 'All browser sessions look healthy';
}

function sortBrowserSessionsForTable(browserSessions: BrowserSessionRecord[], now: number) {
  return [...browserSessions].sort((left, right) => {
    const statusDelta =
      getStatusPriority(getDisplayStatus(left, now)) -
      getStatusPriority(getDisplayStatus(right, now));
    if (statusDelta !== 0) return statusDelta;

    const lastUsedDelta = getDateSortValue(right.lastUsedAt) - getDateSortValue(left.lastUsedAt);
    if (lastUsedDelta !== 0) return lastUsedDelta;

    const createdDelta = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;

    return (left.ipAddress ?? '').localeCompare(right.ipAddress ?? '');
  });
}

function ConnectionActionGroup({ connection }: { connection: ConnectionRecord }) {
  return (
    <Group className={styles.actionGroup} gap={6} wrap="wrap">
      <form
        id={`revoke-connection-${connection.id}`}
        action={revokeConnectionAction}
        style={{ display: 'none' }}
      >
        <input type="hidden" name="connectionId" value={connection.id} />
      </form>
      <ConnectionsConfirmActionButton
        aria-label={`Revoke ${connection.displayName} connection`}
        className={styles.actionButton}
        size="xs"
        style={REVOKE_ACTION_BUTTON_STYLE}
        formId={`revoke-connection-${connection.id}`}
        confirmTitle="Revoke connection"
        confirmMessage={`Revoke ${connection.displayName}? This client will lose access immediately.`}
        confirmLabel="Revoke"
      >
        Revoke
      </ConnectionsConfirmActionButton>
    </Group>
  );
}

function BrowserSessionActionGroup({
  ipLabel,
  session,
}: {
  ipLabel: string;
  session: BrowserSessionRecord;
}) {
  return (
    <Group className={styles.actionGroup} gap={6} wrap="wrap">
      <form
        id={`revoke-browser-session-${session.id}`}
        action={revokeBrowserSessionAction}
        style={{ display: 'none' }}
      >
        <input type="hidden" name="sessionId" value={session.id} />
      </form>
      <ConnectionsConfirmActionButton
        aria-label={`Revoke browser session from ${ipLabel}`}
        className={styles.actionButton}
        size="xs"
        style={REVOKE_ACTION_BUTTON_STYLE}
        formId={`revoke-browser-session-${session.id}`}
        confirmTitle="Revoke browser session"
        confirmMessage={`Revoke the browser session from ${ipLabel}? This browser will need to sign in again.`}
        confirmLabel="Revoke"
      >
        Revoke
      </ConnectionsConfirmActionButton>
    </Group>
  );
}

export default async function ConnectionsPage(props?: {
  searchParams?: Promise<{ legacy?: string }>;
}) {
  const searchParams = props?.searchParams;
  const owner = await getOwnerUserOrNull();
  if (!owner) redirect('/login?reason=auth');
  const params = searchParams ? await searchParams : undefined;

  const [connections, browserSessions, timeZone] = await Promise.all([
    listOwnerMcpConnections(owner.id),
    listOwnerBrowserSessions(owner.id),
    getUserSetting(owner.id, SETTING_KEYS.TIMEZONE),
  ]);
  const visibleConnections = connections.filter((connection) => !connection.revokedAt);
  const visibleBrowserSessions = browserSessions.filter((session) => !session.revokedAt);
  const now = getCurrentTimeMs();
  const summary = getConnectionSummary(visibleConnections, now);
  const sortedConnections = sortConnectionsForTable(visibleConnections, now);
  const browserSessionSummary = getBrowserSessionSummary(visibleBrowserSessions, now);
  const sortedBrowserSessions = sortBrowserSessionsForTable(visibleBrowserSessions, now);

  return (
    <Container
      className="dashboard-root"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <ConnectionsConfirmActionProvider>
        <Stack gap="xl" className="dashboard-stack">
          <WorkspacePageHeader
            title="Connections"
            description="Review client access and browser sign-ins in two focused tables."
          />

          {params?.legacy === '1' ? (
            <Text className={`${styles.legacyNote} ${styles.mutedText}`} size="sm">
              Legacy API-key integrations are being retired. Existing bearer tokens still remain a
              compatibility path for now, but new agent installs should use OAuth-backed MCP
              connections instead.
            </Text>
          ) : null}

          <section className={styles.pageSection} aria-labelledby="connections-clients-heading">
            <Stack gap="sm">
              <div className={styles.sectionHeader}>
                <Text
                  component="h2"
                  id="connections-clients-heading"
                  className={styles.sectionEyebrow}
                  size="xs"
                  fw={700}
                >
                  Connected Clients
                </Text>
              </div>
              {visibleConnections.length > 0 ? (
                <div className={styles.summaryRail}>
                  <Text
                    className={`${styles.summaryHeadline} ${getSummaryHeadlineToneClassName(summary)}`}
                    size="sm"
                    fw={600}
                  >
                    {getSummaryHeadline(summary)}
                  </Text>
                  <Text component="span" className={styles.summaryMeta} size="xs" fw={600}>
                    {summary.total} total
                  </Text>
                </div>
              ) : null}
              {visibleConnections.length === 0 ? (
                <EmptyState
                  align="start"
                  className={styles.sectionEmptyState}
                  icon={<IconPlugConnected size={24} />}
                  iconClassName={styles.emptyStateIcon}
                  title="No connections yet"
                  description="Finish OAuth in an agent and it will appear here with its status, last use, and expiry."
                />
              ) : null}
              {visibleConnections.length > 0 ? (
                <div className={styles.tableShells}>
                  <div className={styles.tableShell}>
                    <div
                      className={styles.tableScroller}
                      role="region"
                      tabIndex={0}
                      aria-labelledby="connections-clients-heading"
                    >
                      <table className={styles.dataTable}>
                        <caption className={styles.tableCaption}>
                          Client connections with status, context, expiry, and access actions.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Connection</th>
                            <th scope="col">Context</th>
                            <th scope="col">Status</th>
                            <th scope="col">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedConnections.map((connection) => {
                            const status = getDisplayStatus(connection, now);
                            const engineLabel = getEngineLabel(connection);
                            const expiryDisplay = getExpiryDisplay(connection, now, timeZone);

                            return (
                              <tr key={connection.id} className={styles.dataRow}>
                                <th
                                  scope="row"
                                  className={`${styles.dataCellPrimary} ${styles.dataRowHeader}`}
                                >
                                  <div className={styles.dataCellStack}>
                                    <Text className={styles.dataCellTitle} fw={600}>
                                      {connection.displayName}
                                    </Text>
                                    <Text
                                      className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                      size="xs"
                                    >
                                      {formatRedirectLabel(connection.redirectUri)}
                                    </Text>
                                  </div>
                                </th>
                                <td className={styles.contextCell}>
                                  <div className={styles.dataCellStack}>
                                    <Text
                                      component="span"
                                      className={styles.dataCellLabel}
                                      size="xs"
                                      fw={700}
                                    >
                                      Context
                                    </Text>
                                    <Text
                                      className={`${styles.dataCellMeta} ${engineLabel === 'Unknown' ? styles.mutedText : ''}`}
                                      size="xs"
                                    >
                                      Engine {engineLabel}
                                    </Text>
                                    <Text
                                      className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                      size="xs"
                                    >
                                      Connected {formatTimestamp(connection.createdAt, timeZone)}
                                    </Text>
                                    <Text
                                      className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                      size="xs"
                                    >
                                      Last used {formatTimestamp(connection.lastUsedAt, timeZone)}
                                    </Text>
                                  </div>
                                </td>
                                <td className={styles.statusCell}>
                                  <div className={styles.dataCellStack}>
                                    <Text
                                      component="span"
                                      className={styles.dataCellLabel}
                                      size="xs"
                                      fw={700}
                                    >
                                      Status
                                    </Text>
                                    <Badge style={getStatusBadgeStyle(status)}>{status}</Badge>
                                    <Text className={styles.dataCellTitle} size="sm" fw={600}>
                                      {expiryDisplay.value}
                                    </Text>
                                    <Text
                                      className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                      size="xs"
                                    >
                                      Expires {expiryDisplay.meta}
                                    </Text>
                                  </div>
                                </td>
                                <td className={styles.actionCell}>
                                  <ConnectionActionGroup connection={connection} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </Stack>
          </section>

          <section
            className={styles.pageSection}
            aria-labelledby="connections-browser-sessions-heading"
          >
            <Stack gap="sm">
              <div className={styles.sectionHeader}>
                <Text
                  component="h2"
                  id="connections-browser-sessions-heading"
                  className={styles.sectionEyebrow}
                  size="xs"
                  fw={700}
                >
                  Browser Sessions
                </Text>
              </div>
              {visibleBrowserSessions.length === 0 ? (
                <EmptyState
                  align="start"
                  className={styles.sectionEmptyState}
                  icon={<IconPlugConnected size={24} />}
                  iconClassName={styles.emptyStateIcon}
                  title="No browser sessions yet"
                  description="Your next owner sign-in appears here so you can review the device and revoke it if needed."
                />
              ) : null}
              {visibleBrowserSessions.length > 0 ? (
                <>
                  <div className={styles.summaryRail}>
                    <Text
                      className={`${styles.summaryHeadline} ${getSummaryHeadlineToneClassName(browserSessionSummary)}`}
                      size="sm"
                      fw={600}
                    >
                      {getBrowserSessionSummaryHeadline(browserSessionSummary)}
                    </Text>
                    <Text component="span" className={styles.summaryMeta} size="xs" fw={600}>
                      {browserSessionSummary.total} total
                    </Text>
                  </div>
                  <div className={styles.tableShells}>
                    <div className={styles.tableShell}>
                      <div
                        className={styles.tableScroller}
                        role="region"
                        tabIndex={0}
                        aria-labelledby="connections-browser-sessions-heading"
                      >
                        <table className={styles.dataTable}>
                          <caption className={styles.tableCaption}>
                            Browser sessions with status, device context, expiry, and access
                            actions.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Session</th>
                              <th scope="col">Context</th>
                              <th scope="col">Status</th>
                              <th scope="col">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedBrowserSessions.map((session) => {
                              const status = getDisplayStatus(session, now);
                              const expiryDisplay = getExpiryDisplay(session, now, timeZone);
                              const browserLabel = formatBrowserSessionValue(
                                session.browserName,
                                'Browser not detected',
                              );
                              const osLabel = formatBrowserSessionValue(
                                session.osName,
                                'OS not detected',
                              );
                              const ipLabel = formatBrowserSessionValue(
                                session.ipAddress,
                                'IP unavailable',
                              );

                              return (
                                <tr key={session.id} className={styles.dataRow}>
                                  <th
                                    scope="row"
                                    className={`${styles.dataCellPrimary} ${styles.dataRowHeader}`}
                                  >
                                    <div className={styles.dataCellStack}>
                                      <Text className={styles.dataCellTitle} fw={600}>
                                        {browserLabel}
                                      </Text>
                                      <Text
                                        className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                        size="xs"
                                      >
                                        {osLabel} · {ipLabel}
                                      </Text>
                                    </div>
                                  </th>
                                  <td className={styles.contextCell}>
                                    <div className={styles.dataCellStack}>
                                      <Text
                                        component="span"
                                        className={styles.dataCellLabel}
                                        size="xs"
                                        fw={700}
                                      >
                                        Context
                                      </Text>
                                      <Text
                                        className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                        size="xs"
                                      >
                                        Signed in {formatTimestamp(session.createdAt, timeZone)}
                                      </Text>
                                      <Text
                                        className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                        size="xs"
                                      >
                                        Last used {formatTimestamp(session.lastUsedAt, timeZone)}
                                      </Text>
                                    </div>
                                  </td>
                                  <td className={styles.statusCell}>
                                    <div className={styles.dataCellStack}>
                                      <Text
                                        component="span"
                                        className={styles.dataCellLabel}
                                        size="xs"
                                        fw={700}
                                      >
                                        Status
                                      </Text>
                                      <Badge style={getStatusBadgeStyle(status)}>{status}</Badge>
                                      <Text className={styles.dataCellTitle} size="sm" fw={600}>
                                        {expiryDisplay.value}
                                      </Text>
                                      <Text
                                        className={`${styles.dataCellMeta} ${styles.mutedText}`}
                                        size="xs"
                                      >
                                        Expires {expiryDisplay.meta}
                                      </Text>
                                    </div>
                                  </td>
                                  <td className={styles.actionCell}>
                                    <BrowserSessionActionGroup
                                      ipLabel={ipLabel}
                                      session={session}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </Stack>
          </section>
        </Stack>
      </ConnectionsConfirmActionProvider>
    </Container>
  );
}
