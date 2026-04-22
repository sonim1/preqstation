import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const findFirst = vi.fn();
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  return {
    findFirst,
    getUserSetting: vi.fn(),
    revalidatePath: vi.fn(),
    requireOwnerUser: vi.fn(),
    update,
    updateSet,
    updateWhere,
    withOwnerDb: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: mocked.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/actions/project-actions', () => ({
  createProject: vi.fn(),
  createWorkLog: vi.fn(),
  updateProject: vi.fn(),
  updateProjectLinks: vi.fn(),
}));

vi.mock('@/lib/actions/task-actions', () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return actual;
});

vi.mock('@/lib/next-utils', () => ({
  isNextRedirectError: () => false,
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/task-labels', () => ({
  getTaskLabelIdsFromFormData: vi.fn(() => []),
}));

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSetting: mocked.getUserSetting,
  };
});

import { toggleTodayFocus } from '@/app/(workspace)/(main)/dashboard/actions';

describe('app/(workspace)/(main)/dashboard/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T04:30:00.000Z'));

    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSetting.mockResolvedValue('America/Los_Angeles');
    mocked.findFirst.mockResolvedValue({
      id: 'task-1',
      focusedAt: new Date('2026-03-24T18:00:00.000Z'),
    });
    mocked.withOwnerDb.mockImplementation(async (_ownerId: string, callback: Function) =>
      callback({
        query: {
          tasks: {
            findFirst: mocked.findFirst,
          },
        },
        update: mocked.update,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears today focus when the saved timezone still considers the task focused today', async () => {
    const formData = new FormData();
    formData.set('taskId', 'task-1');

    await toggleTodayFocus(formData);

    expect(mocked.updateSet).toHaveBeenCalledWith({ focusedAt: null });
  });
});
