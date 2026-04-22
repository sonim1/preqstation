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
  listDispatchRequests: vi.fn(),
  updateDispatchRequestState: vi.fn(),
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

vi.mock('@/lib/dispatch-request-store', () => ({
  DISPATCH_REQUEST_OBJECTIVES: ['ask', 'insight'],
  DISPATCH_REQUEST_SCOPES: ['task', 'project'],
  DISPATCH_REQUEST_STATES: ['queued', 'dispatched', 'failed'],
  DISPATCH_REQUEST_TARGETS: ['claude-code-channel'],
  listDispatchRequests: mocked.listDispatchRequests,
  updateDispatchRequestState: mocked.updateDispatchRequestState,
}));

import { registerPreqTools, summarizeDispatchRequest, summarizeTask } from '@/lib/mcp/tools';

describe('summarizeTask', () => {
  it('preserves dispatch fields needed by Claude dispatch polling', () => {
    expect(
      summarizeTask({
        id: 'task-uuid',
        task_key: 'PROJ-123',
        title: 'Ship dispatch',
        status: 'todo',
        run_state: 'queued',
        engine: 'claude-code',
        branch: 'task/proj-123/ship-dispatch',
        dispatch_target: 'claude-code-channel',
      }),
    ).toMatchObject({
      id: 'task-uuid',
      task_key: 'PROJ-123',
      status: 'todo',
      run_state: 'queued',
      engine: 'claude-code',
      branch_name: 'task/proj-123/ship-dispatch',
      dispatch_target: 'claude-code-channel',
    });
  });
});

describe('summarizeDispatchRequest', () => {
  it('normalizes dispatch request fields for MCP consumers', () => {
    expect(
      summarizeDispatchRequest({
        id: 'req-1',
        scope: 'task',
        objective: 'ask',
        state: 'queued',
        taskKey: 'PROJ-328',
        projectKey: 'PROJ',
        branchName: 'task/proj-328/rewrite-note',
        dispatchTarget: 'claude-code-channel',
        promptMetadata: { askHint: '더 명확하게 정리해줘' },
      }),
    ).toMatchObject({
      id: 'req-1',
      scope: 'task',
      objective: 'ask',
      state: 'queued',
      task_key: 'PROJ-328',
      project_key: 'PROJ',
      branch_name: 'task/proj-328/rewrite-note',
      dispatch_target: 'claude-code-channel',
      prompt_metadata: { askHint: '더 명확하게 정리해줘' },
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

describe('registerPreqTools dispatch request tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.listDispatchRequests.mockResolvedValue([
      {
        id: 'req-1',
        scope: 'task',
        objective: 'ask',
        state: 'queued',
        taskKey: 'PROJ-328',
        projectKey: 'PROJ',
        dispatchTarget: 'claude-code-channel',
      },
      {
        id: 'req-2',
        scope: 'project',
        objective: 'insight',
        state: 'queued',
        projectKey: 'PROJ',
        dispatchTarget: 'claude-code-channel',
      },
    ]);
    mocked.updateDispatchRequestState.mockResolvedValue({
      id: 'req-2',
      scope: 'project',
      objective: 'insight',
      state: 'dispatched',
      projectKey: 'PROJ',
      dispatchTarget: 'claude-code-channel',
    });
  });

  it('lists normalized dispatch requests and applies scope filtering after the store query', async () => {
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

    const result = await handlers.get('preq_list_dispatch_requests')!({
      state: 'queued',
      objective: 'insight',
      scope: 'project',
      dispatchTarget: 'claude-code-channel',
      limit: 10,
    });
    const payload = JSON.parse(result.content[0].text);

    expect(mocked.listDispatchRequests).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      state: 'queued',
      objective: 'insight',
      dispatchTarget: 'claude-code-channel',
      limit: 10,
    });
    expect(payload).toEqual({
      count: 1,
      requests: [
        expect.objectContaining({
          id: 'req-2',
          scope: 'project',
          objective: 'insight',
          state: 'queued',
          project_key: 'PROJ',
        }),
      ],
    });
  });

  it('updates dispatch request state through the dedicated MCP tool', async () => {
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

    const result = await handlers.get('preq_update_dispatch_request')!({
      requestId: 'req-2',
      state: 'dispatched',
      errorMessage: '',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(mocked.updateDispatchRequestState).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      requestId: 'req-2',
      state: 'dispatched',
      errorMessage: null,
    });
    expect(payload.request).toMatchObject({
      id: 'req-2',
      scope: 'project',
      objective: 'insight',
      state: 'dispatched',
      project_key: 'PROJ',
    });
  });
});
