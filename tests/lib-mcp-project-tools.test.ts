import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  createInternalApiToken: vi.fn(),
  withOwnerDb: vi.fn(),
  listProjectsRoute: vi.fn(),
  listTasksRoute: vi.fn(),
  createTaskRoute: vi.fn(),
  getTaskRoute: vi.fn(),
  patchTaskRoute: vi.fn(),
  deleteTaskRoute: vi.fn(),
  patchTaskStatusRoute: vi.fn(),
  getProjectSettingsRoute: vi.fn(),
  patchQaRunRoute: vi.fn(),
}));

vi.mock('@/lib/api-tokens', () => ({
  createInternalApiToken: mocked.createInternalApiToken,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/app/api/projects/route', () => ({
  GET: mocked.listProjectsRoute,
}));

vi.mock('@/app/api/tasks/route', () => ({
  GET: mocked.listTasksRoute,
  POST: mocked.createTaskRoute,
}));

vi.mock('@/app/api/tasks/[id]/route', () => ({
  GET: mocked.getTaskRoute,
  PATCH: mocked.patchTaskRoute,
  DELETE: mocked.deleteTaskRoute,
}));

vi.mock('@/app/api/tasks/[id]/status/route', () => ({
  PATCH: mocked.patchTaskStatusRoute,
}));

vi.mock('@/app/api/projects/[id]/settings/route', () => ({
  GET: mocked.getProjectSettingsRoute,
}));

vi.mock('@/app/api/qa-runs/[id]/route', () => ({
  PATCH: mocked.patchQaRunRoute,
}));

import { registerPreqTools } from '@/lib/mcp/tools';

describe('registerPreqTools preq_list_projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
    mocked.listProjectsRoute.mockResolvedValue(
      new Response(
        JSON.stringify({
          projects: [
            {
              id: 'project-1',
              projectKey: 'PROJ',
              name: 'Project A',
              repoUrl: 'https://github.com/acme/proj',
            },
            {
              id: 'project-2',
              projectKey: 'OPS',
              name: 'Operations',
              repoUrl: null,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
  });

  it('registers preq_list_projects and returns normalized project summaries', async () => {
    const handlers = new Map<
      string,
      (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text: string }> }>
    >();
    const server = {
      registerTool: vi.fn((name, _config, handler) => {
        handlers.set(name, handler);
      }),
    };

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    expect(handlers.has('preq_list_projects')).toBe(true);

    const result = await handlers.get('preq_list_projects')!({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload).toEqual({
      count: 2,
      projects: [
        {
          id: 'project-1',
          key: 'PROJ',
          name: 'Project A',
          repoUrl: 'https://github.com/acme/proj',
        },
        {
          id: 'project-2',
          key: 'OPS',
          name: 'Operations',
          repoUrl: null,
        },
      ],
    });

    expect(mocked.listProjectsRoute).toHaveBeenCalledOnce();
    const request = mocked.listProjectsRoute.mock.calls[0][0] as Request;
    expect(request.url).toBe('https://internal.preqstation.local/api/projects');
    expect(request.headers.get('authorization')).toBe('Bearer preq_test_token');
  });

  it('registers preq_list_tasks and filters returned tasks by engine, run_state, and dispatch_target', async () => {
    mocked.listTasksRoute.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tasks: [
            {
              id: 'task-1',
              task_key: 'PROJ-1',
              title: 'Dispatch Telegram task',
              status: 'ready',
              run_state: 'queued',
              engine: 'claude-code',
              dispatch_target: 'telegram',
            },
            {
              id: 'task-2',
              task_key: 'PROJ-2',
              title: 'Wrong engine',
              status: 'ready',
              run_state: 'queued',
              engine: 'codex',
              dispatch_target: 'telegram',
            },
            {
              id: 'task-3',
              task_key: 'PROJ-3',
              title: 'Wrong run state',
              status: 'ready',
              run_state: 'working',
              engine: 'claude-code',
              dispatch_target: 'telegram',
            },
            {
              id: 'task-4',
              task_key: 'PROJ-4',
              title: 'Wrong dispatch target',
              status: 'ready',
              run_state: 'queued',
              engine: 'claude-code',
              dispatch_target: 'hermes-telegram',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const handlers = new Map<
      string,
      (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text: string }> }>
    >();
    const server = {
      registerTool: vi.fn((name, _config, handler) => {
        handlers.set(name, handler);
      }),
    };

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    const result = await handlers.get('preq_list_tasks')!({
      engine: 'claude-code',
      runState: 'queued',
      dispatchTarget: 'telegram',
      projectKey: 'PROJ',
      limit: 5,
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.tasks).toEqual([
      {
        id: 'task-1',
        task_key: 'PROJ-1',
        title: 'Dispatch Telegram task',
        status: 'ready',
        run_state: 'queued',
        run_state_updated_at: null,
        priority: null,
        repo: null,
        engine: 'claude-code',
        branch_name: null,
        dispatch_target: 'telegram',
        labels: [],
        updated_at: null,
      },
    ]);

    const request = mocked.listTasksRoute.mock.calls[0][0] as Request;
    const url = new URL(request.url);
    expect(url.searchParams.get('compact')).toBe('1');
    expect(url.searchParams.get('engine')).toBe('claude-code');
    expect(url.searchParams.get('run_state')).toBe('queued');
    expect(url.searchParams.get('dispatch_target')).toBe('telegram');
    expect(url.searchParams.get('project_key')).toBe('PROJ');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('supports full detail mode without forcing compact task responses', async () => {
    mocked.listTasksRoute.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tasks: [
            {
              id: 'PROJ-1',
              task_key: 'PROJ-1',
              title: 'Verbose task',
              status: 'todo',
              engine: 'codex',
              description: 'Long body',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const handlers = new Map<
      string,
      (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text: string }> }>
    >();
    const server = {
      registerTool: vi.fn((name, _config, handler) => {
        handlers.set(name, handler);
      }),
    };

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    const result = await handlers.get('preq_list_tasks')!({
      engine: 'codex',
      detail: 'full',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload).toEqual({
      count: 1,
      total: 1,
      total_api_tasks: 1,
      detail: 'full',
      project_key: null,
      tasks: [
        {
          id: 'PROJ-1',
          task_key: 'PROJ-1',
          title: 'Verbose task',
          status: 'todo',
          engine: 'codex',
          description: 'Long body',
        },
      ],
    });

    const request = mocked.listTasksRoute.mock.calls[0][0] as Request;
    const url = new URL(request.url);
    expect(url.searchParams.get('compact')).toBeNull();
  });
});

describe('registerPreqTools preq_list_project_activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
  });

  it('returns a date-range activity feed across tasks, comments, and work logs', async () => {
    const project = {
      id: 'project-1',
      projectKey: 'PQST',
      name: 'Preqstation',
      repoUrl: 'https://github.com/sonim1/preqstation',
    };
    const task = {
      id: 'task-1',
      taskKey: 'PQST-113',
      taskPrefix: 'PQST',
      title: 'Fix labels',
      note: 'Make label display durable',
      status: 'todo',
      taskPriority: 'high',
      branch: 'task/pqst-113',
      engine: 'codex',
      dispatchTarget: 'telegram',
      runState: null,
      createdAt: new Date('2026-05-13T07:00:00.000Z'),
      updatedAt: new Date('2026-05-13T08:00:00.000Z'),
      project,
    };
    const comment = {
      id: 'comment-1',
      authorType: 'agent',
      body: 'PR opened and tests passed',
      createdAt: new Date('2026-05-13T09:00:00.000Z'),
      updatedAt: new Date('2026-05-13T09:00:00.000Z'),
      task,
      project,
    };
    const workLog = {
      id: 'worklog-1',
      title: 'PREQSTATION Result',
      detail: 'Completed implementation and opened PR',
      workedAt: new Date('2026-05-13T10:00:00.000Z'),
      createdAt: new Date('2026-05-13T10:00:01.000Z'),
      task,
      project,
    };
    const client = {
      query: {
        projects: { findMany: vi.fn().mockResolvedValue([{ id: 'project-1' }]) },
        tasks: { findMany: vi.fn().mockResolvedValue([task]) },
        taskComments: { findMany: vi.fn().mockResolvedValue([comment]) },
        workLogs: { findMany: vi.fn().mockResolvedValue([workLog]) },
      },
    };
    mocked.withOwnerDb.mockImplementation(async (_ownerId, callback) => callback(client));

    const handlers = new Map<
      string,
      (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text: string }> }>
    >();
    const server = {
      registerTool: vi.fn((name, _config, handler) => {
        handlers.set(name, handler);
      }),
    };

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    const result = await handlers.get('preq_list_project_activity')!({
      projectKeys: ['pqst'],
      from: '2026-05-12T10:00:00.000Z',
      to: '2026-05-13T10:30:00.000Z',
      limit: 10,
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload).toMatchObject({
      from: '2026-05-12T10:00:00.000Z',
      to: '2026-05-13T10:30:00.000Z',
      project_keys: ['PQST'],
      count: 3,
      has_more: false,
      next_cursor: null,
    });
    expect(payload.events.map((event: { type: string }) => event.type)).toEqual([
      'work_log.created',
      'task_comment.created',
      'task.updated',
    ]);
    expect(payload.events[0]).toMatchObject({
      event_id: 'work_log:worklog-1:worked:2026-05-13T10:00:00.000Z',
      project_key: 'PQST',
      task_key: 'PQST-113',
      title: 'PREQSTATION Result',
      summary: 'Completed implementation and opened PR',
      source: 'work_log',
    });
    expect(client.query.tasks.findMany).toHaveBeenCalledOnce();
    expect(client.query.taskComments.findMany).toHaveBeenCalledOnce();
    expect(client.query.workLogs.findMany).toHaveBeenCalledOnce();
  });

  it('paginates activity with an opaque cursor', async () => {
    const project = { id: 'project-1', projectKey: 'PQST', name: 'Preqstation', repoUrl: null };
    const makeTask = (id: string, taskKey: string, updatedAt: string) => ({
      id,
      taskKey,
      taskPrefix: 'PQST',
      title: taskKey,
      note: null,
      status: 'todo',
      taskPriority: 'none',
      branch: null,
      engine: 'codex',
      dispatchTarget: null,
      runState: null,
      createdAt: new Date('2026-05-13T00:00:00.000Z'),
      updatedAt: new Date(updatedAt),
      project,
    });
    const client = {
      query: {
        projects: { findMany: vi.fn().mockResolvedValue([{ id: 'project-1' }]) },
        tasks: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              makeTask('task-1', 'PQST-1', '2026-05-13T10:00:00.000Z'),
              makeTask('task-2', 'PQST-2', '2026-05-13T09:00:00.000Z'),
            ])
            .mockResolvedValueOnce([
              makeTask('task-1', 'PQST-1', '2026-05-13T10:00:00.000Z'),
              makeTask('task-2', 'PQST-2', '2026-05-13T09:00:00.000Z'),
            ]),
        },
        taskComments: { findMany: vi.fn().mockResolvedValue([]) },
        workLogs: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };
    mocked.withOwnerDb.mockImplementation(async (_ownerId, callback) => callback(client));

    const handlers = new Map<
      string,
      (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: string; text: string }> }>
    >();
    const server = { registerTool: vi.fn((name, _config, handler) => handlers.set(name, handler)) };
    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    const first = await handlers.get('preq_list_project_activity')!({
      projectKeys: ['PQST'],
      from: '2026-05-13T00:00:00.000Z',
      to: '2026-05-14T00:00:00.000Z',
      limit: 1,
    });
    const firstPayload = JSON.parse(first.content[0].text);
    expect(firstPayload.events).toHaveLength(1);
    expect(firstPayload.has_more).toBe(true);
    expect(firstPayload.next_cursor).toEqual(expect.any(String));

    const second = await handlers.get('preq_list_project_activity')!({
      projectKeys: ['PQST'],
      from: '2026-05-13T00:00:00.000Z',
      to: '2026-05-14T00:00:00.000Z',
      limit: 1,
      cursor: firstPayload.next_cursor,
    });
    const secondPayload = JSON.parse(second.content[0].text);
    expect(secondPayload.events[0].task_key).toBe('PQST-2');
  });
});
