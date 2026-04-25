import { beforeEach, describe, expect, it, vi } from 'vitest';

const tasksFindManyMock = vi.hoisted(() => vi.fn());
const tasksFindFirstMock = vi.hoisted(() => vi.fn());
const projectsFindFirstMock = vi.hoisted(() => vi.fn());
const taskLabelsFindManyMock = vi.hoisted(() => vi.fn());
const selectOrderByMock = vi.hoisted(() => vi.fn());
const selectWhereMock = vi.hoisted(() => vi.fn());
const selectFromMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  query: {
    tasks: {
      findMany: tasksFindManyMock,
      findFirst: tasksFindFirstMock,
    },
    projects: {
      findFirst: projectsFindFirstMock,
    },
    taskLabels: {
      findMany: taskLabelsFindManyMock,
    },
  },
  select: selectMock,
}));
const getOwnerUserOrNullMock = vi.hoisted(() => vi.fn());
const resolveProjectByKeyMock = vi.hoisted(() => vi.fn());
const getUserSettingMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/app/components/board-content', () => ({
  BoardContent: () => null,
}));

vi.mock('@/lib/actions/board-actions', () => ({
  boardUpdateTask: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: dbMock,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(dbMock),
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: getOwnerUserOrNullMock,
}));

vi.mock('@/lib/project-resolve', () => ({
  resolveProjectByKey: resolveProjectByKeyMock,
}));

vi.mock('@/lib/kanban-helpers', () => ({
  groupTasksByStatus: () => ({
    inbox: [],
    todo: [],
    hold: [],
    ready: [],
    done: [],
    archived: [],
  }),
}));

vi.mock('@/lib/task-labels', () => ({
  extractTaskLabels: () => [],
  groupTaskLabelsByProjectId: () => ({}),
}));

vi.mock('@/lib/task-meta', () => ({
  coerceTaskRunState: (value: string | null) => value,
  taskPriorityOptionData: () => [],
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: {
    TELEGRAM_ENABLED: 'telegram_enabled',
    HERMES_TELEGRAM_ENABLED: 'hermes_telegram_enabled',
  },
  getUserSetting: getUserSettingMock,
}));

import ProjectBoardPage from '@/app/(workspace)/(main)/board/[key]/page';
import BoardPage from '@/app/(workspace)/(main)/board/page';
import { TASK_BOARD_ORDER } from '@/lib/task-sort-order';

describe('board page task query', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    tasksFindManyMock.mockResolvedValue([]);
    tasksFindFirstMock.mockResolvedValue(undefined);
    projectsFindFirstMock.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
      bgImage: null,
    });
    taskLabelsFindManyMock.mockResolvedValue([]);

    selectOrderByMock.mockResolvedValue([]);
    selectWhereMock.mockReturnValue({ orderBy: selectOrderByMock });
    selectFromMock.mockReturnValue({ where: selectWhereMock });
    selectMock.mockReturnValue({ from: selectFromMock });

    getOwnerUserOrNullMock.mockResolvedValue({ id: 'owner-1' });
    resolveProjectByKeyMock.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
    });
    getUserSettingMock.mockResolvedValue('true');
  });

  it('does not apply a global task cap on the all-projects board query', async () => {
    await BoardPage({ searchParams: Promise.resolve({}) });

    expect(tasksFindManyMock).toHaveBeenCalledTimes(1);
    expect(tasksFindManyMock.mock.calls[0]?.[0]).not.toHaveProperty('limit');
  });

  it('does not apply a global task cap on the project board query', async () => {
    await ProjectBoardPage({
      params: Promise.resolve({ key: 'PROJ' }),
      searchParams: Promise.resolve({}),
    });

    expect(tasksFindManyMock).toHaveBeenCalledTimes(1);
    expect(tasksFindManyMock.mock.calls[0]?.[0]).not.toHaveProperty('limit');
  });

  it('uses the shared board-order contract on the all-projects board query', async () => {
    await BoardPage({ searchParams: Promise.resolve({}) });

    expect(tasksFindManyMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ orderBy: TASK_BOARD_ORDER }),
    );
  });

  it('uses the shared board-order contract on the project board query', async () => {
    await ProjectBoardPage({
      params: Promise.resolve({ key: 'PROJ' }),
      searchParams: Promise.resolve({}),
    });

    expect(tasksFindManyMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ orderBy: TASK_BOARD_ORDER }),
    );
  });
});
