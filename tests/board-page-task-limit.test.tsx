import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbTask = {
  id: string;
  taskKey: string;
  status: 'inbox' | 'todo' | 'hold' | 'ready' | 'done' | 'archived';
};

const mocked = vi.hoisted(() => {
  const state = {
    tasks: [] as DbTask[],
  };

  const projectSelectOrderBy = vi.fn().mockResolvedValue([]);
  const projectSelectWhere = vi.fn(() => ({ orderBy: projectSelectOrderBy }));
  const projectSelectFrom = vi.fn(() => ({ where: projectSelectWhere }));
  const countWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
  const countSelectFrom = vi.fn(() => ({ where: countWhere }));

  return {
    state,
    countWhere,
    getOwnerUserOrNull: vi.fn(),
    resolveProjectByKey: vi.fn(),
    getUserSetting: vi.fn(),
    boardUpdateTask: vi.fn(),
    groupTasksByStatus: vi.fn((todos: DbTask[]) => ({
      inbox: todos.filter((todo) => todo.status === 'inbox'),
      todo: todos.filter((todo) => todo.status === 'todo'),
      hold: todos.filter((todo) => todo.status === 'hold'),
      ready: todos.filter((todo) => todo.status === 'ready'),
      done: todos.filter((todo) => todo.status === 'done'),
      archived: todos.filter((todo) => todo.status === 'archived'),
    })),
    taskPriorityOptionData: vi.fn(() => []),
    extractTaskLabels: vi.fn(() => []),
    coerceTaskRunState: vi.fn((value: string | null | undefined) => value ?? null),
    normalizeTaskIdentifier: vi.fn(() => ''),
    taskWhereByIdentifier: vi.fn(),
    getProjectBoardBgUrl: vi.fn(() => null),
    getProjectBackgroundCredit: vi.fn(() => null),
    db: {
      execute: vi.fn().mockResolvedValue({ rows: [{ relation_name: 'qa_runs' }] }),
      query: {
        tasks: {
          findMany: vi.fn(({ limit }: { limit?: number } = {}) =>
            Promise.resolve(state.tasks.slice(0, limit ?? state.tasks.length)),
          ),
          findFirst: vi.fn(),
        },
        taskLabels: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        projects: {
          findFirst: vi.fn(),
        },
        projectSettings: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        qaRuns: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      select: vi.fn((selection?: Record<string, unknown>) =>
        selection && 'count' in selection ? { from: countSelectFrom } : { from: projectSelectFrom },
      ),
    },
  };
});

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/app/components/board-content', () => ({
  BoardContent: () => null,
}));

vi.mock('@/lib/actions/board-actions', () => ({
  boardUpdateTask: mocked.boardUpdateTask,
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/lib/user-settings', () => ({
  SETTING_KEYS: { TELEGRAM_ENABLED: 'telegram_enabled' },
  getUserSetting: mocked.getUserSetting,
}));

vi.mock('@/lib/kanban-helpers', () => ({
  groupTasksByStatus: mocked.groupTasksByStatus,
}));

vi.mock('@/lib/task-meta', () => ({
  coerceTaskRunState: mocked.coerceTaskRunState,
  taskPriorityOptionData: mocked.taskPriorityOptionData,
}));

vi.mock('@/lib/task-labels', () => ({
  extractTaskLabels: mocked.extractTaskLabels,
  groupTaskLabelsByProjectId: vi.fn(() => ({})),
}));

vi.mock('@/lib/task-keys', () => ({
  normalizeTaskIdentifier: mocked.normalizeTaskIdentifier,
  taskWhereByIdentifier: mocked.taskWhereByIdentifier,
}));

vi.mock('@/lib/project-resolve', () => ({
  resolveProjectByKey: mocked.resolveProjectByKey,
}));

vi.mock('@/lib/project-backgrounds', () => ({
  getProjectBoardBgUrl: mocked.getProjectBoardBgUrl,
  getProjectBackgroundCredit: mocked.getProjectBackgroundCredit,
}));

import ProjectBoardPage from '@/app/(workspace)/(main)/board/[key]/page';
import BoardPage from '@/app/(workspace)/(main)/board/page';

function makeTasks(count: number): DbTask[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `task-${index + 1}`,
    taskKey: `PROJ-${index + 1}`,
    status: 'todo',
  }));
}

function getBoardProps(element: unknown) {
  return (
    element as ReactElement<{
      kanbanTasks: Record<string, DbTask[]>;
      initialArchivedCount: number;
      archiveProjectId: string | null;
      readyQaConfig?: {
        projectName: string;
        branchName: string;
        runs: Array<{ id: string }>;
      } | null;
    }>
  ).props;
}

describe('board page task loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocked.state.tasks = [];
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.getUserSetting.mockResolvedValue('false');
    mocked.countWhere.mockResolvedValue([{ count: 0 }]);
    mocked.resolveProjectByKey.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'proj',
    });
    mocked.db.query.tasks.findFirst.mockResolvedValue(undefined);
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'proj',
      bgImage: null,
    });
    mocked.db.execute.mockResolvedValue({ rows: [{ relation_name: 'qa_runs' }] });
    mocked.db.query.projectSettings.findMany.mockResolvedValue([]);
    mocked.db.query.qaRuns.findMany.mockResolvedValue([]);
  });

  it('does not truncate the main board task list at 200 items', async () => {
    mocked.state.tasks = makeTasks(205);
    mocked.countWhere.mockResolvedValueOnce([{ count: 17 }]);

    const element = await BoardPage({ searchParams: Promise.resolve({}) });
    const props = getBoardProps(element);

    expect(props.kanbanTasks.todo).toHaveLength(205);
    expect(props.kanbanTasks.archived).toEqual([]);
    expect(props.initialArchivedCount).toBe(17);
    expect(props.archiveProjectId).toBeNull();
    expect(mocked.db.query.tasks.findMany.mock.calls[0]?.[0]?.limit).toBeUndefined();
  });

  it('does not truncate the project board task list at 200 items', async () => {
    mocked.state.tasks = makeTasks(205);
    mocked.countWhere.mockResolvedValueOnce([{ count: 9 }]);

    const element = await ProjectBoardPage({
      params: Promise.resolve({ key: 'proj' }),
      searchParams: Promise.resolve({}),
    });
    const props = getBoardProps(element);

    expect(props.kanbanTasks.todo).toHaveLength(205);
    expect(props.kanbanTasks.archived).toEqual([]);
    expect(props.initialArchivedCount).toBe(9);
    expect(props.archiveProjectId).toBe('project-1');
    expect(mocked.db.query.tasks.findMany.mock.calls[0]?.[0]?.limit).toBeUndefined();
    expect(props.readyQaConfig?.projectName).toBe('Project One');
  });

  it('keeps successive project board renders scoped to the latest project key', async () => {
    mocked.resolveProjectByKey.mockImplementation(async (_ownerId: string, key: string) =>
      key === 'ALPHA'
        ? {
            id: 'project-alpha',
            name: 'Project Alpha',
            projectKey: 'ALPHA',
          }
        : {
            id: 'project-beta',
            name: 'Project Beta',
            projectKey: 'BETA',
          },
    );

    const first = await ProjectBoardPage({
      params: Promise.resolve({ key: 'ALPHA' }),
      searchParams: Promise.resolve({}),
    });
    const second = await ProjectBoardPage({
      params: Promise.resolve({ key: 'BETA' }),
      searchParams: Promise.resolve({}),
    });

    expect(getBoardProps(first).archiveProjectId).toBe('project-alpha');
    expect(getBoardProps(first).readyQaConfig?.projectName).toBe('Project Alpha');
    expect(getBoardProps(second).archiveProjectId).toBe('project-beta');
    expect(getBoardProps(second).readyQaConfig?.projectName).toBe('Project Beta');
  });

  it('keeps the project board renderable when auxiliary settings queries fail', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mocked.db.query.projectSettings.findMany.mockRejectedValueOnce(
        new Error('relation "project_settings" does not exist'),
      );
      mocked.db.query.qaRuns.findMany.mockRejectedValueOnce(
        new Error('relation "qa_runs" does not exist'),
      );

      const element = await ProjectBoardPage({
        params: Promise.resolve({ key: 'proj' }),
        searchParams: Promise.resolve({}),
      });
      const props = getBoardProps(element);

      expect(props.readyQaConfig?.projectName).toBe('Project One');
      expect(props.readyQaConfig?.branchName).toBe('main');
      expect(props.readyQaConfig?.runs).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('skips the QA runs query when the qa_runs table is unavailable', async () => {
    mocked.db.execute.mockResolvedValueOnce({ rows: [{ relation_name: null }] });

    const element = await ProjectBoardPage({
      params: Promise.resolve({ key: 'proj' }),
      searchParams: Promise.resolve({}),
    });
    const props = getBoardProps(element);

    expect(mocked.db.query.qaRuns.findMany).not.toHaveBeenCalled();
    expect(props.readyQaConfig?.runs).toEqual([]);
  });

  it('renders the project board when QA runs and project settings stall', async () => {
    vi.useFakeTimers();
    mocked.db.execute.mockReturnValue(new Promise(() => {}));
    mocked.db.query.projectSettings.findMany.mockReturnValue(new Promise(() => {}));

    const pagePromise = ProjectBoardPage({
      params: Promise.resolve({ key: 'proj' }),
      searchParams: Promise.resolve({}),
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const element = await pagePromise;
    const props = getBoardProps(element);

    expect(props.readyQaConfig?.projectName).toBe('Project One');
    expect(props.readyQaConfig?.branchName).toBe('main');
    expect(props.readyQaConfig?.runs).toEqual([]);
  });
});
