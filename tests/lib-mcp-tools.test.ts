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

import { registerPreqTools, summarizeTask } from '@/lib/mcp/tools';

describe('summarizeTask', () => {
  it('preserves dispatch fields needed by task polling', () => {
    expect(
      summarizeTask({
        id: 'task-uuid',
        task_key: 'PROJ-123',
        title: 'Ship dispatch',
        status: 'todo',
        run_state: 'queued',
        engine: 'claude-code',
        branch: 'task/proj-123/ship-dispatch',
        dispatch_target: 'telegram',
      }),
    ).toMatchObject({
      id: 'task-uuid',
      task_key: 'PROJ-123',
      status: 'todo',
      run_state: 'queued',
      engine: 'claude-code',
      branch_name: 'task/proj-123/ship-dispatch',
      dispatch_target: 'telegram',
    });
  });
});

describe('registerPreqTools preq_complete_task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
    mocked.getTaskRoute.mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: 'PROJ-337',
            task_key: 'PROJ-337',
            title: 'Investigate this issue',
            status: 'todo',
            engine: 'codex',
            branch: null,
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    mocked.patchTaskRoute.mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: 'PROJ-337',
            task_key: 'PROJ-337',
            status: 'ready',
            branch: 'task/proj-337/investigate-this-issue',
            engine: 'codex',
          },
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

  it('forwards branchName into the uploaded result and PATCH payload', async () => {
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

    const result = await handlers.get('preq_complete_task')!({
      taskId: 'PROJ-337',
      summary: 'Done',
      tests: 'npm run typecheck && npm run test:unit',
      notes: 'Committed directly to origin/main',
      branchName: 'task/proj-337/investigate-this-issue',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.uploaded_result).toMatchObject({
      branch: 'task/proj-337/investigate-this-issue',
      completed_at: expect.any(String),
    });

    const request = mocked.patchTaskRoute.mock.calls[0][0] as Request;
    const requestBody = JSON.parse(await request.text());

    expect(requestBody).toMatchObject({
      lifecycle_action: 'complete',
      branch: 'task/proj-337/investigate-this-issue',
      result: expect.objectContaining({
        branch: 'task/proj-337/investigate-this-issue',
        completed_at: expect.any(String),
      }),
    });
  });

  it('surfaces backend validation detail when complete is rejected', async () => {
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
    mocked.patchTaskRoute.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error:
            'This project cannot move to ready yet. Deployment strategy requires a pushed feature branch and PR before review.',
        }),
        {
          status: 409,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    await expect(
      handlers.get('preq_complete_task')!({
        taskId: 'PROJ-337',
        summary: 'Done',
      }),
    ).rejects.toThrow(/pushed feature branch and PR before review/);
  });
});

describe('registerPreqTools preq_get_task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
  });

  it('treats partial JSON-looking success bodies as non-JSON responses', async () => {
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
    mocked.getTaskRoute.mockResolvedValueOnce(
      new Response('{"task"', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
    );

    registerPreqTools(server as never, {
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      connectionId: 'conn-1',
      getDetectedClientEngine: () => null,
    });

    await expect(
      handlers.get('preq_get_task')!({
        taskId: 'PROJ-337',
      }),
    ).rejects.toThrow(/returned non-JSON success response/);
  });
});

describe('registerPreqTools preq_update_task_note', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
    mocked.getTaskRoute.mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: 'PROJ-337',
            task_key: 'PROJ-337',
            title: 'Investigate this issue',
            status: 'todo',
            engine: 'codex',
            branch: null,
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );
    mocked.patchTaskRoute.mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: 'PROJ-337',
            task_key: 'PROJ-337',
            status: 'todo',
            note: '## Context\n\nTighter rewrite',
            engine: 'codex',
          },
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

  it('sends raw note markdown without changing workflow status', async () => {
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

    const result = await handlers.get('preq_update_task_note')!({
      taskId: 'PROJ-337',
      noteMarkdown: '## Context\n\nTighter rewrite',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.task).toMatchObject({
      status: 'todo',
      note: '## Context\n\nTighter rewrite',
    });

    const request = mocked.patchTaskRoute.mock.calls[0][0] as Request;
    const requestBody = JSON.parse(await request.text());

    expect(requestBody).toMatchObject({
      noteMarkdown: '## Context\n\nTighter rewrite',
      engine: 'codex',
    });
    expect(requestBody.lifecycle_action).toBeUndefined();
    expect(requestBody.status).toBeUndefined();
  });
});
