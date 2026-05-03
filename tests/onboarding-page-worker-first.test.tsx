import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  return {
    getOwnerUserOrNull: vi.fn(),
    redirect: vi.fn(),
    select,
    selectFrom,
    selectWhere,
    findProject: vi.fn(),
    findTask: vi.fn(),
    findConnection: vi.fn(),
    findWorkLog: vi.fn(),
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
    desc: vi.fn((arg: unknown) => ({ type: 'desc', arg })),
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
    isNull: vi.fn((arg: unknown) => ({ type: 'isNull', arg })),
    isNotNull: vi.fn((arg: unknown) => ({ type: 'isNotNull', arg })),
    gt: vi.fn((...args: unknown[]) => ({ type: 'gt', args })),
    or: vi.fn((...args: unknown[]) => ({ type: 'or', args })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
  };
});

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback({
      select: mocked.select,
      query: {
        projects: { findFirst: mocked.findProject },
        tasks: { findFirst: mocked.findTask },
        mcpConnections: { findFirst: mocked.findConnection },
        workLogs: { findFirst: mocked.findWorkLog },
      },
    }),
}));

vi.mock('@/lib/db/schema', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema');
  return {
    ...actual,
    projects: {
      ownerId: 'projects.ownerId',
      deletedAt: 'projects.deletedAt',
      createdAt: 'projects.createdAt',
    },
    tasks: {
      ownerId: 'tasks.ownerId',
      projectId: 'tasks.projectId',
      archivedAt: 'tasks.archivedAt',
      createdAt: 'tasks.createdAt',
      engine: 'tasks.engine',
      runState: 'tasks.runState',
    },
    mcpConnections: {
      ownerId: 'mcpConnections.ownerId',
      revokedAt: 'mcpConnections.revokedAt',
      expiresAt: 'mcpConnections.expiresAt',
      lastUsedAt: 'mcpConnections.lastUsedAt',
      createdAt: 'mcpConnections.createdAt',
    },
    workLogs: {
      ownerId: 'workLogs.ownerId',
      engine: 'workLogs.engine',
      workedAt: 'workLogs.workedAt',
      createdAt: 'workLogs.createdAt',
    },
  };
});

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/app/(workspace)/(onboarding)/onboarding/actions', () => ({
  createOnboardingProject: vi.fn(),
  createOnboardingTask: vi.fn(),
}));

vi.mock('@/app/(workspace)/(onboarding)/onboarding/onboarding-wizard', () => ({
  OnboardingWizard: (props: Record<string, unknown>) => (
    <pre data-testid="onboarding-props">{JSON.stringify(props)}</pre>
  ),
}));

import OnboardingPage from '@/app/(workspace)/(onboarding)/onboarding/page';

describe('app/(workspace)/(onboarding)/onboarding/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' });
    mocked.selectWhere.mockResolvedValue([{ count: 0 }]);
    mocked.findProject.mockResolvedValue(null);
    mocked.findTask.mockResolvedValue(null);
    mocked.findConnection.mockResolvedValue(null);
    mocked.findWorkLog.mockResolvedValue(null);
  });

  it('renders onboarding instead of redirecting when the owner has no projects', async () => {
    const page = await OnboardingPage();

    expect(mocked.redirect).not.toHaveBeenCalledWith('/dashboard');
    expect(page).toEqual(
      expect.objectContaining({
        type: expect.any(Function),
        props: expect.objectContaining({
          initialProject: null,
          initialTask: null,
          workerReadiness: expect.objectContaining({ status: 'missing' }),
        }),
      }),
    );
  });

  it('lets owners confirm existing project and task state and marks worker ready from MCP', async () => {
    mocked.selectWhere.mockResolvedValue([{ count: 1 }]);
    mocked.findProject.mockResolvedValue({
      id: 'project-1',
      name: 'Launch Ops',
      projectKey: 'OPS',
    });
    mocked.findTask.mockResolvedValue({
      id: 'task-1',
      taskKey: 'OPS-1',
      title: 'Ship worker setup',
      status: 'todo',
      engine: 'codex',
      runState: null,
    });
    mocked.findConnection.mockResolvedValue({
      id: 'connection-1',
      displayName: 'Codex MCP',
      engine: 'codex',
      lastUsedAt: new Date('2026-05-01T12:00:00Z'),
    });

    const page = await OnboardingPage();

    expect(mocked.redirect).not.toHaveBeenCalledWith('/dashboard');
    expect(page).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          initialProject: { id: 'project-1', name: 'Launch Ops', projectKey: 'OPS' },
          initialTask: {
            id: 'task-1',
            taskKey: 'OPS-1',
            title: 'Ship worker setup',
            status: 'todo',
          },
          workerReadiness: expect.objectContaining({
            status: 'ready',
            label: 'Worker connected',
            detail: 'Codex MCP is connected for worker execution.',
          }),
        }),
      }),
    );
  });
});
