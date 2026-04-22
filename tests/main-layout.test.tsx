import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const orderBy = vi.fn();
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    getOwnerUserOrNull: vi.fn(),
    getUserSetting: vi.fn(),
    orderBy,
    redirect: vi.fn(),
    select,
  };
});

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    asc: vi.fn((arg: unknown) => ({ type: 'asc', arg })),
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
    isNull: vi.fn((arg: unknown) => ({ type: 'isNull', arg })),
  };
});

vi.mock('@/app/components/event-poller', () => ({
  EventPoller: ({ intervalMs }: { intervalMs?: number }) => (
    <div data-event-poller={String(intervalMs)}>poller</div>
  ),
}));

vi.mock('@/app/components/sign-out-form', () => ({
  SignOutForm: () => <div data-sign-out-form="true" />,
}));

vi.mock('@/app/components/workspace-shell', () => ({
  WorkspaceShell: ({ children, email }: { children: React.ReactNode; email: string }) => (
    <div data-workspace-shell={email}>{children}</div>
  ),
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({ select: mocked.select }),
}));

vi.mock('@/lib/db/schema', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    ...actual,
    projects: {
      ...actual.projects,
      id: 'id',
      name: 'name',
      projectKey: 'projectKey',
      ownerId: 'ownerId',
      deletedAt: 'deletedAt',
    },
  };
});

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    SYNC_INTERVAL: 'sync_interval',
  },
  getUserSetting: mocked.getUserSetting,
}));

import MainLayout from '@/app/(workspace)/(main)/layout';

describe('app/(workspace)/(main)/layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' });
    mocked.orderBy.mockResolvedValue([{ id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' }]);
    mocked.getUserSetting.mockResolvedValue('60000');
  });

  it('mounts the event poller when a sync interval exists', async () => {
    const page = await MainLayout({ children: <div>Board</div> });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('data-event-poller="60000"');
    expect(mocked.getUserSetting).toHaveBeenCalledWith(
      'owner-1',
      'sync_interval',
      expect.anything(),
    );
  });
});
