import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  createInternalApiToken: vi.fn(),
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
