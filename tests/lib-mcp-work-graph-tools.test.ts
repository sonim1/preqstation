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
  listTaskCommentsRoute: vi.fn(),
  getTaskCommentRoute: vi.fn(),
  patchTaskCommentRoute: vi.fn(),
  replyTaskCommentRoute: vi.fn(),
  getWorkGraphRoute: vi.fn(),
  initWorkGraphRoute: vi.fn(),
  createWorkNodeRoute: vi.fn(),
  patchWorkNodeRoute: vi.fn(),
  attachWorkNodeEvidenceRoute: vi.fn(),
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

vi.mock('@/app/api/tasks/[id]/comments/route', () => ({
  GET: mocked.listTaskCommentsRoute,
}));

vi.mock('@/app/api/task-comments/[id]/route', () => ({
  GET: mocked.getTaskCommentRoute,
  PATCH: mocked.patchTaskCommentRoute,
}));

vi.mock('@/app/api/task-comments/[id]/reply/route', () => ({
  POST: mocked.replyTaskCommentRoute,
}));

vi.mock('@/app/api/tasks/[id]/work-graph/route', () => ({
  GET: mocked.getWorkGraphRoute,
}));

vi.mock('@/app/api/tasks/[id]/work-graph/init/route', () => ({
  POST: mocked.initWorkGraphRoute,
}));

vi.mock('@/app/api/tasks/[id]/work-graph/nodes/route', () => ({
  POST: mocked.createWorkNodeRoute,
}));

vi.mock('@/app/api/work-nodes/[nodeId]/route', () => ({
  PATCH: mocked.patchWorkNodeRoute,
}));

vi.mock('@/app/api/work-nodes/[nodeId]/evidence/route', () => ({
  POST: mocked.attachWorkNodeEvidenceRoute,
}));

import { registerPreqTools } from '@/lib/mcp/tools';

function registerHandlers() {
  const handlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
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
    getDetectedClientEngine: () => 'codex',
  });

  return { handlers, server };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('registerPreqTools work graph tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createInternalApiToken.mockResolvedValue('preq_test_token');
    mocked.getWorkGraphRoute.mockResolvedValue(
      jsonResponse({
        ok: true,
        schema_version: 'preqstation.v2.0',
        data: {
          summary: { root_overlay: 'running', running_count: 1 },
          nodes: [{ id: 'node-1', status: 'running' }],
        },
      }),
    );
    mocked.initWorkGraphRoute.mockResolvedValue(
      jsonResponse({ ok: true, data: { created: true, node: { id: 'root' } } }, 201),
    );
    mocked.createWorkNodeRoute.mockResolvedValue(
      jsonResponse({ ok: true, data: { created: true, node: { id: 'node-1' } } }, 201),
    );
    mocked.patchWorkNodeRoute.mockResolvedValue(
      jsonResponse({ ok: true, data: { node: { id: 'node-1', status: 'completed' } } }),
    );
    mocked.attachWorkNodeEvidenceRoute.mockResolvedValue(
      jsonResponse({ ok: true, data: { evidence: { id: 'evidence-1' } } }, 201),
    );
  });

  it('registers runtime-agnostic work graph tools', () => {
    const { handlers } = registerHandlers();

    expect(handlers.has('preq_graph_state')).toBe(true);
    expect(handlers.has('preq_graph_node_create')).toBe(true);
    expect(handlers.has('preq_graph_node_update')).toBe(true);
    expect(handlers.has('preq_graph_evidence_attach')).toBe(true);
  });

  it('initializes and reads graph state through internal bearer API routes', async () => {
    const { handlers } = registerHandlers();

    const result = await handlers.get('preq_graph_state')!({
      taskId: 'PROJ-42',
      initialize: true,
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.initialized.data.node.id).toBe('root');
    expect(payload.graph.data.nodes[0].id).toBe('node-1');
    expect(mocked.initWorkGraphRoute).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ params: expect.any(Promise) }),
    );
    expect(mocked.getWorkGraphRoute).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ params: expect.any(Promise) }),
    );

    const initRequest = mocked.initWorkGraphRoute.mock.calls[0][0] as Request;
    const getRequest = mocked.getWorkGraphRoute.mock.calls[0][0] as Request;

    expect(initRequest.headers.get('authorization')).toBe('Bearer preq_test_token');
    expect(getRequest.url).toContain('/api/tasks/PROJ-42/work-graph');
  });

  it('creates graph nodes with the stable API payload shape', async () => {
    const { handlers } = registerHandlers();

    await handlers.get('preq_graph_node_create')!({
      taskId: 'PROJ-42',
      type: 'implement',
      title: 'Build bridge',
      status: 'ready',
      parentId: 'root',
      runtimeTarget: 'local',
      idempotencyKey: 'runtime-step-1',
      dependencyIds: ['node-before'],
    });

    const request = mocked.createWorkNodeRoute.mock.calls[0][0] as Request;
    const body = JSON.parse(await request.text());

    expect(body).toMatchObject({
      type: 'implement',
      title: 'Build bridge',
      status: 'ready',
      parent_id: 'root',
      runtime_target: 'local',
      idempotency_key: 'runtime-step-1',
      dependency_ids: ['node-before'],
    });
  });

  it('updates graph nodes and attaches evidence through node routes', async () => {
    const { handlers } = registerHandlers();

    await handlers.get('preq_graph_node_update')!({
      nodeId: 'node-1',
      action: 'complete',
      resultSummary: 'Implemented and tested.',
    });
    await handlers.get('preq_graph_evidence_attach')!({
      nodeId: 'node-1',
      kind: 'test',
      title: 'Vitest',
      summary: '12 passed',
      payload: { command: 'npm run test:unit' },
      artifactUrl: 'https://example.com/test.log',
    });

    const updateRequest = mocked.patchWorkNodeRoute.mock.calls[0][0] as Request;
    const updateBody = JSON.parse(await updateRequest.text());
    const evidenceRequest = mocked.attachWorkNodeEvidenceRoute.mock.calls[0][0] as Request;
    const evidenceBody = JSON.parse(await evidenceRequest.text());

    expect(updateBody).toMatchObject({
      action: 'complete',
      result_summary: 'Implemented and tested.',
    });
    expect(evidenceBody).toMatchObject({
      kind: 'test',
      title: 'Vitest',
      summary: '12 passed',
      payload: { command: 'npm run test:unit' },
      artifact_url: 'https://example.com/test.log',
    });
  });
});
