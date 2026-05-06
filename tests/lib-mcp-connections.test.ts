import { and, eq, gt, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  ownerClient: {
    update: vi.fn(),
  },
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
  withOwnerDb: vi.fn(),
}));

vi.mock('@/lib/db/rls', () => ({
  withAdminDb: vi.fn(),
  withOwnerDb: mocked.withOwnerDb,
}));

import { mcpConnections } from '@/lib/db/schema';
import { revokeActiveOwnerMcpConnections } from '@/lib/mcp/connections';

describe('lib/mcp/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.updateReturning.mockReset();
    mocked.updateWhere.mockReturnValue({ returning: mocked.updateReturning });
    mocked.updateSet.mockReturnValue({ where: mocked.updateWhere });
    mocked.ownerClient.update.mockReturnValue({ set: mocked.updateSet });
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
    mocked.updateReturning.mockResolvedValue([{ id: 'connection-1' }]);
  });

  it('bulk revokes only active non-expired owner MCP connections', async () => {
    const now = new Date('2026-03-26T09:00:00.000Z');
    const revokedAt = new Date('2026-03-26T10:30:00.000Z');

    const revoked = await revokeActiveOwnerMcpConnections({
      ownerId: 'owner-1',
      now,
      revokedAt,
    });

    expect(mocked.withOwnerDb).toHaveBeenCalledWith('owner-1', expect.any(Function));
    expect(mocked.updateSet).toHaveBeenCalledWith({ revokedAt });
    expect(mocked.updateWhere).toHaveBeenCalledWith(
      and(
        eq(mcpConnections.ownerId, 'owner-1'),
        isNull(mcpConnections.revokedAt),
        gt(mcpConnections.expiresAt, now),
      ),
    );
    expect(revoked).toEqual([{ id: 'connection-1' }]);
  });
});
