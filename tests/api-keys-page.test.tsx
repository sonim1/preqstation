import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const orderBy = vi.fn();
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const db = { select };

  return {
    db,
    getOwnerUserOrNull: vi.fn(),
    getUserSetting: vi.fn(),
    orderBy,
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    requireOwnerUser: vi.fn(),
    select,
    writeAuditLog: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    desc: vi.fn((arg: unknown) => ({ type: 'desc', arg })),
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  };
});

vi.mock('@/app/components/confirm-action-button', () => ({
  ConfirmActionButton: ({
    children,
    confirmLabel: _confirmLabel,
    confirmMessage: _confirmMessage,
    confirmTitle: _confirmTitle,
    formId: _formId,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    confirmLabel?: React.ReactNode;
    confirmMessage?: React.ReactNode;
    confirmTitle?: React.ReactNode;
    formId?: string;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-empty-state="true">
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

vi.mock('@/app/components/submit-button', () => ({
  SubmitButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="submit" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/app/(workspace)/(main)/api-keys/api-key-create-form', () => ({
  ApiKeyCreateForm: () => <div data-slot="api-key-create-form" />,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return {
    ...actual,
    apiTokens: {
      ...actual.apiTokens,
      id: 'id',
      ownerId: 'ownerId',
      name: 'name',
      tokenPrefix: 'tokenPrefix',
      lastUsedAt: 'lastUsedAt',
      expiresAt: 'expiresAt',
      revokedAt: 'revokedAt',
      createdAt: 'createdAt',
    },
  };
});

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/terminology', () => ({
  resolveTerminology: vi.fn(() => ({
    task: {
      pluralLower: 'tasks',
    },
  })),
}));

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSetting: mocked.getUserSetting,
  };
});

import ApiKeysPage from '@/app/(workspace)/(main)/api-keys/page';

describe('app/(workspace)/(main)/api-keys/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSetting.mockImplementation(async (_ownerId: string, key: string) => {
      if (key === 'timezone') return 'UTC';
      return 'false';
    });
    mocked.orderBy.mockResolvedValue([
      {
        id: 'token-1',
        name: 'CLI',
        tokenPrefix: 'pk_test',
        lastUsedAt: new Date('2026-03-18T10:03:00.000Z'),
        expiresAt: new Date('2026-04-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-03-10T12:00:00.000Z'),
      },
    ]);
  });

  it('redirects the legacy page to the connections route', async () => {
    const result = await ApiKeysPage();

    expect(result).toBeUndefined();
    expect(mocked.redirect).toHaveBeenCalledWith('/connections?legacy=1');
  });

  it('redirects consistently across successive loads', async () => {
    const first = await ApiKeysPage();
    const second = await ApiKeysPage();

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(mocked.redirect).toHaveBeenNthCalledWith(1, '/connections?legacy=1');
    expect(mocked.redirect).toHaveBeenNthCalledWith(2, '/connections?legacy=1');
  });
});
