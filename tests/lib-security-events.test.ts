import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const ownerInsertValues = vi.fn();
  const adminInsertValues = vi.fn();
  const ownerClient = {
    insert: vi.fn(() => ({ values: ownerInsertValues })),
  };
  const adminClient = {
    insert: vi.fn(() => ({ values: adminInsertValues })),
  };

  return {
    ownerInsertValues,
    adminInsertValues,
    ownerClient,
    adminClient,
    withOwnerDb: vi.fn(),
    withAdminDb: vi.fn(),
  };
});

vi.mock('@/lib/db/rls', () => ({
  withAdminDb: mocked.withAdminDb,
  withOwnerDb: mocked.withOwnerDb,
}));

import { writeSecurityEvent } from '@/lib/security-events';

describe('lib/security-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.ownerInsertValues.mockResolvedValue(undefined);
    mocked.adminInsertValues.mockResolvedValue(undefined);
    mocked.withOwnerDb.mockImplementation(
      async (_ownerId: string, callback: (client: typeof mocked.ownerClient) => unknown) =>
        callback(mocked.ownerClient),
    );
    mocked.withAdminDb.mockImplementation(
      async (callback: (client: typeof mocked.adminClient) => unknown) =>
        callback(mocked.adminClient),
    );
  });

  it('uses the owner-scoped helper when an owner id is available', async () => {
    await writeSecurityEvent({
      ownerId: 'owner-1',
      actorEmail: 'owner@example.com',
      eventType: 'auth.owner_setup',
      outcome: 'allowed',
    });

    expect(mocked.withOwnerDb).toHaveBeenCalledWith('owner-1', expect.any(Function));
    expect(mocked.withAdminDb).not.toHaveBeenCalled();
    expect(mocked.ownerClient.insert).toHaveBeenCalledOnce();
  });

  it('uses the explicit admin path for unauthenticated security events', async () => {
    await writeSecurityEvent({
      actorEmail: 'intruder@example.com',
      eventType: 'auth.password_sign_in',
      outcome: 'blocked',
    });

    expect(mocked.withOwnerDb).not.toHaveBeenCalled();
    expect(mocked.withAdminDb).toHaveBeenCalledOnce();
    expect(mocked.adminClient.insert).toHaveBeenCalledOnce();
  });
});
