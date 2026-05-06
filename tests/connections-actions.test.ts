import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  requireOwnerUser: vi.fn(),
  revokeActiveOwnerBrowserSessions: vi.fn(),
  revokeActiveOwnerMcpConnections: vi.fn(),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/browser-sessions', () => ({
  revokeActiveOwnerBrowserSessions: mocked.revokeActiveOwnerBrowserSessions,
  revokeBrowserSession: vi.fn(),
}));

vi.mock('@/lib/mcp/connections', () => ({
  revokeActiveOwnerMcpConnections: mocked.revokeActiveOwnerMcpConnections,
  setMcpConnectionRevokedState: vi.fn(),
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

import {
  revokeAllBrowserSessionsAction,
  revokeAllConnectionsAction,
} from '@/app/(workspace)/(main)/connections/actions';

describe('app/(workspace)/(main)/connections/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.revokeActiveOwnerBrowserSessions.mockResolvedValue([]);
    mocked.revokeActiveOwnerMcpConnections.mockResolvedValue([]);
  });

  it('propagates unexpected errors when revoking all connected clients fails', async () => {
    const error = new Error('database unavailable');
    mocked.revokeActiveOwnerMcpConnections.mockRejectedValueOnce(error);

    await expect(revokeAllConnectionsAction()).rejects.toThrow('database unavailable');
  });

  it('propagates unexpected errors when revoking all browser sessions fails', async () => {
    const error = new Error('database unavailable');
    mocked.revokeActiveOwnerBrowserSessions.mockRejectedValueOnce(error);

    await expect(revokeAllBrowserSessionsAction()).rejects.toThrow('database unavailable');
  });

  it('keeps unauthorized responses handled by bulk revoke actions', async () => {
    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    await expect(revokeAllConnectionsAction()).resolves.toBeUndefined();

    mocked.requireOwnerUser.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }));

    await expect(revokeAllBrowserSessionsAction()).resolves.toBeUndefined();
  });
});
