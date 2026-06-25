import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  requireOwnerUser: vi.fn(),
  withOwnerDb: vi.fn(),
  tasksFindFirst: vi.fn(),
  listKnowledgeProposals: vi.fn(),
  createKnowledgeProposal: vi.fn(),
  updateKnowledgeProposalStatus: vi.fn(),
}));

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/knowledge-proposals', () => ({
  createKnowledgeProposal: mocked.createKnowledgeProposal,
  listKnowledgeProposals: mocked.listKnowledgeProposals,
  updateKnowledgeProposalStatus: mocked.updateKnowledgeProposalStatus,
}));

import {
  GET,
  PATCH,
  POST,
} from '@/app/api/tasks/[id]/knowledge-proposals/route';

const client = {
  query: {
    tasks: {
      findFirst: mocked.tasksFindFirst,
    },
  },
};

describe('task knowledge proposals route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.withOwnerDb.mockImplementation(async (_ownerId: string, callback: (db: unknown) => unknown) =>
      callback(client),
    );
    mocked.tasksFindFirst.mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-1',
      projectId: 'project-1',
    });
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'Runtime token',
    });
    mocked.requireOwnerUser.mockRejectedValue(new Response(null, { status: 401 }));
    mocked.listKnowledgeProposals.mockResolvedValue([{ id: 'proposal-1', status: 'pending' }]);
    mocked.createKnowledgeProposal.mockResolvedValue({ id: 'proposal-1', status: 'pending' });
    mocked.updateKnowledgeProposalStatus.mockResolvedValue({ id: 'proposal-1', status: 'applied' });
  });

  it('lists task proposals for an authenticated runtime token', async () => {
    const response = await GET(
      new Request('https://example.com/api/tasks/PROJ-1/knowledge-proposals', {
        headers: { authorization: 'Bearer preq_test_token' },
      }),
      { params: Promise.resolve({ id: 'PROJ-1' }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.data.proposals).toEqual([{ id: 'proposal-1', status: 'pending' }]);
    expect(mocked.listKnowledgeProposals).toHaveBeenCalledWith({
      client,
      ownerId: 'owner-1',
      taskId: 'task-1',
    });
  });

  it('lets runtime tokens create pending proposals', async () => {
    const response = await POST(
      new Request('https://example.com/api/tasks/PROJ-1/knowledge-proposals', {
        method: 'POST',
        headers: {
          authorization: 'Bearer preq_test_token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          target: 'docs/architecture.md',
          body: 'Remember the runtime bridge contract.',
          rationale: 'Learned while implementing graph evidence.',
          source_node_id: 'node-1',
        }),
      }),
      { params: Promise.resolve({ id: 'PROJ-1' }) },
    );

    expect(response.status).toBe(201);
    expect(mocked.createKnowledgeProposal).toHaveBeenCalledWith({
      client,
      ownerId: 'owner-1',
      taskId: 'task-1',
      input: expect.objectContaining({
        target: 'docs/architecture.md',
        body: 'Remember the runtime bridge contract.',
        rationale: 'Learned while implementing graph evidence.',
        sourceNodeId: 'node-1',
      }),
    });
  });

  it('rejects proposal application through runtime tokens', async () => {
    const response = await PATCH(
      new Request('https://example.com/api/tasks/PROJ-1/knowledge-proposals', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer preq_test_token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ proposal_id: 'proposal-1', status: 'applied' }),
      }),
      { params: Promise.resolve({ id: 'PROJ-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocked.updateKnowledgeProposalStatus).not.toHaveBeenCalled();
  });

  it('allows session users to apply proposals explicitly', async () => {
    mocked.authenticateApiToken.mockResolvedValueOnce(null);
    mocked.requireOwnerUser.mockResolvedValueOnce({ id: 'owner-1', email: 'owner@example.com' });

    const response = await PATCH(
      new Request('https://example.com/api/tasks/PROJ-1/knowledge-proposals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposal_id: 'proposal-1', status: 'applied' }),
      }),
      { params: Promise.resolve({ id: 'PROJ-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mocked.updateKnowledgeProposalStatus).toHaveBeenCalledWith({
      client,
      ownerId: 'owner-1',
      taskId: 'task-1',
      proposalId: 'proposal-1',
      status: 'applied',
    });
  });
});
