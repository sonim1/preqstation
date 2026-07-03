import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  writeAuditLog: vi.fn(),
  getWorkGraph: vi.fn(),
  initializeWorkGraph: vi.fn(),
  createWorkNode: vi.fn(),
  appendWorkflowMemory: vi.fn(),
  db: {
    query: {
      tasks: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: typeof mocked.db) => unknown) =>
    callback(mocked.db),
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: vi.fn(),
}));

vi.mock('@/lib/work-graph-service', () => ({
  WorkGraphServiceError: class WorkGraphServiceError extends Error {},
  getWorkGraph: mocked.getWorkGraph,
  initializeWorkGraph: mocked.initializeWorkGraph,
  createWorkNode: mocked.createWorkNode,
  appendWorkflowMemory: mocked.appendWorkflowMemory,
}));

import { POST as INIT } from '@/app/api/tasks/[id]/work-graph/init/route';
import { POST as MEMORY } from '@/app/api/tasks/[id]/work-graph/memory/route';
import { POST as CREATE_NODE } from '@/app/api/tasks/[id]/work-graph/nodes/route';
import { GET } from '@/app/api/tasks/[id]/work-graph/route';

const AUTH = {
  ownerId: 'owner-1',
  ownerEmail: 'owner@example.com',
  tokenId: 'token-1',
  tokenName: 'Runtime token',
};

const TASK = {
  id: 'task-1',
  taskKey: 'PREQ-1',
  projectId: 'project-1',
};

function request(path: string, body?: unknown) {
  return new Request(`${TEST_BASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('task work graph API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue(AUTH);
    mocked.db.query.tasks.findFirst.mockResolvedValue(TASK);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.getWorkGraph.mockResolvedValue({
      summary: { running_count: 0, ready_count: 1, root_overlay: 'ready' },
      nodes: [{ id: 'node-1', title: 'Root' }],
    });
    mocked.initializeWorkGraph.mockResolvedValue({ node: { id: 'root-node' }, created: true });
    mocked.createWorkNode.mockResolvedValue({ node: { id: 'node-2' }, created: true });
    mocked.appendWorkflowMemory.mockResolvedValue({ id: 'task-1' });
  });

  it('GET returns the versioned work graph envelope', async () => {
    const response = await GET(request('/api/tasks/PREQ-1/work-graph'), {
      params: Promise.resolve({ id: 'PREQ-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      schema_version: 'preqstation.v2.0',
      request_id: expect.stringMatching(/^req_/),
      data: {
        summary: { running_count: 0, ready_count: 1, root_overlay: 'ready' },
        nodes: [{ id: 'node-1', title: 'Root' }],
      },
      warnings: [],
    });
    expect(mocked.getWorkGraph).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-1', taskId: 'task-1' }),
    );
  });

  it('POST init initializes the graph and audits token identity', async () => {
    const response = await INIT(request('/api/tasks/PREQ-1/work-graph/init', {}), {
      params: Promise.resolve({ id: 'PREQ-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toEqual({ node: { id: 'root-node' }, created: true });
    expect(mocked.initializeWorkGraph).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-1', taskId: 'task-1' }),
    );
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'work_graph.initialized.via_api_token',
        targetType: 'work_graph',
        targetId: 'PREQ-1',
        meta: expect.objectContaining({
          actor: 'api_token',
          tokenId: 'token-1',
          tokenName: 'Runtime token',
        }),
      }),
      mocked.db,
    );
  });

  it('POST nodes maps snake_case input into service create payload', async () => {
    const response = await CREATE_NODE(
      request('/api/tasks/PREQ-1/work-graph/nodes', {
        type: 'analyze',
        title: 'Analyze CLI',
        idempotency_key: 'worker-1:analyze',
        dependency_ids: ['root-node'],
      }),
      { params: Promise.resolve({ id: 'PREQ-1' }) },
    );

    expect(response.status).toBe(201);
    expect(mocked.createWorkNode).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'task-1',
        input: expect.objectContaining({
          type: 'analyze',
          title: 'Analyze CLI',
          idempotencyKey: 'worker-1:analyze',
          dependencyIds: ['root-node'],
        }),
      }),
    );
  });

  it('POST nodes passes workflow profile metadata into the service payload', async () => {
    const workflowProfile = {
      requested: 'auto',
      manual_command: null,
      resolved: 'gstack-plan-eng-review',
      resolved_command: '/plan-eng-review',
      resolved_reason: 'Architecture review needed before implementation.',
    };

    const response = await CREATE_NODE(
      request('/api/tasks/PREQ-1/work-graph/nodes', {
        type: 'analyze',
        title: 'Analyze workflow choice',
        metadata: { workflow_profile: workflowProfile },
      }),
      { params: Promise.resolve({ id: 'PREQ-1' }) },
    );

    expect(response.status).toBe(201);
    expect(mocked.createWorkNode).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          metadata: { workflow_profile: workflowProfile },
        }),
      }),
    );
  });

  it('POST memory appends bounded workflow memory', async () => {
    const response = await MEMORY(
      request('/api/tasks/PREQ-1/work-graph/memory', {
        append_markdown: 'Found flaky test root cause.',
      }),
      { params: Promise.resolve({ id: 'PREQ-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.appendWorkflowMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        taskId: 'task-1',
        appendMarkdown: 'Found flaky test root cause.',
      }),
    );
  });
});
