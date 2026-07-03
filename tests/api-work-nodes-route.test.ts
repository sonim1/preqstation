import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  writeAuditLog: vi.fn(),
  transitionWorkNode: vi.fn(),
  attachWorkNodeEvidence: vi.fn(),
  db: {
    query: {
      taskWorkNodes: { findFirst: vi.fn() },
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

vi.mock('@/lib/work-graph-service', () => ({
  WorkGraphServiceError: class WorkGraphServiceError extends Error {},
  transitionWorkNode: mocked.transitionWorkNode,
  attachWorkNodeEvidence: mocked.attachWorkNodeEvidence,
}));

import { POST as ATTACH_EVIDENCE } from '@/app/api/work-nodes/[nodeId]/evidence/route';
import { PATCH } from '@/app/api/work-nodes/[nodeId]/route';

const AUTH = {
  ownerId: 'owner-1',
  ownerEmail: 'owner@example.com',
  tokenId: 'token-1',
  tokenName: 'Runtime token',
};

function request(path: string, body: unknown) {
  return new Request(`${TEST_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('work node API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue(AUTH);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.transitionWorkNode.mockResolvedValue({ id: 'node-1', status: 'completed' });
    mocked.attachWorkNodeEvidence.mockResolvedValue({ id: 'evidence-1', kind: 'test' });
  });

  it('PATCH transitions a node through the service and audits the node target', async () => {
    const response = await PATCH(
      request('/api/work-nodes/node-1', {
        action: 'complete',
        result_summary: 'All tests passed.',
      }),
      { params: Promise.resolve({ nodeId: 'node-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      schema_version: 'preqstation.v2.0',
      data: { node: { id: 'node-1', status: 'completed' } },
    });
    expect(mocked.transitionWorkNode).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        nodeId: 'node-1',
        action: 'complete',
        resultSummary: 'All tests passed.',
      }),
    );
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'work_node.transitioned.via_api_token',
        targetType: 'work_node',
        targetId: 'node-1',
      }),
      mocked.db,
    );
  });

  it('PATCH passes workflow profile metadata into the transition service payload', async () => {
    const workflowProfile = {
      requested: 'auto',
      manual_command: null,
      resolved: 'gstack-plan-eng-review',
      resolved_command: '/plan-eng-review',
      resolved_reason: 'Architecture review needed before implementation.',
    };

    const response = await PATCH(
      request('/api/work-nodes/node-1', {
        action: 'complete',
        metadata: { workflow_profile: workflowProfile },
      }),
      { params: Promise.resolve({ nodeId: 'node-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.transitionWorkNode).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'node-1',
        action: 'complete',
        metadata: { workflow_profile: workflowProfile },
      }),
    );
  });

  it('POST evidence attaches bounded evidence payloads', async () => {
    const response = await ATTACH_EVIDENCE(
      request('/api/work-nodes/node-1/evidence', {
        kind: 'test',
        title: 'Unit tests',
        payload: { command: 'npm test', exit_code: 0 },
      }),
      { params: Promise.resolve({ nodeId: 'node-1' }) },
    );

    expect(response.status).toBe(201);
    expect(mocked.attachWorkNodeEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        nodeId: 'node-1',
        input: expect.objectContaining({
          kind: 'test',
          title: 'Unit tests',
          payload: { command: 'npm test', exit_code: 0 },
        }),
      }),
    );
  });
});
