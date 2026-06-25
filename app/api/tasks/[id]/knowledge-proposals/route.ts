import { z } from 'zod';

import { withOwnerDb } from '@/lib/db/rls';
import {
  createKnowledgeProposal,
  KnowledgeProposalError,
  listKnowledgeProposals,
  updateKnowledgeProposalStatus,
} from '@/lib/knowledge-proposals';
import {
  authenticateWorkGraphRequest,
  resolveTaskForWorkGraph,
  workGraphError,
  workGraphOk,
} from '@/lib/work-graph-api';

const createProposalSchema = z.object({
  target: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  rationale: z.string().optional().nullable(),
  sourceNodeId: z.string().optional().nullable(),
  source_node_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const updateProposalSchema = z.object({
  proposalId: z.string().optional(),
  proposal_id: z.string().optional(),
  status: z.enum(['applied', 'rejected']),
});

function handleKnowledgeProposalError(error: unknown) {
  if (error instanceof KnowledgeProposalError) {
    return workGraphError(error.code, error.message, error.status, error.details);
  }

  console.error('Knowledge proposal API error', error);
  return workGraphError('internal_error', 'Internal server error', 500);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const proposals = await listKnowledgeProposals({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
      });
      return workGraphOk({ proposals });
    });
  } catch (error) {
    return handleKnowledgeProposalError(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const parsed = createProposalSchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const input = parsed.data;
      const proposal = await createKnowledgeProposal({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
        input: {
          target: input.target,
          body: input.body,
          rationale: input.rationale,
          sourceNodeId: input.source_node_id ?? input.sourceNodeId,
          metadata: input.metadata,
        },
      });

      return workGraphOk({ proposal }, { status: 201 });
    });
  } catch (error) {
    return handleKnowledgeProposalError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    if (auth.source === 'api_token') {
      return workGraphError(
        'forbidden',
        'Applying or rejecting knowledge proposals requires a signed-in user.',
        403,
      );
    }

    const parsed = updateProposalSchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const proposalId = parsed.data.proposal_id ?? parsed.data.proposalId;
    if (!proposalId) return workGraphError('invalid_request', 'Proposal id is required', 400);
    const { id } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const task = await resolveTaskForWorkGraph({ client, ownerId: auth.ownerId, identifier: id });
      if (!task) return workGraphError('not_found', 'Task not found', 404);

      const proposal = await updateKnowledgeProposalStatus({
        client,
        ownerId: auth.ownerId,
        taskId: task.id,
        proposalId,
        status: parsed.data.status,
      });

      return workGraphOk({ proposal });
    });
  } catch (error) {
    return handleKnowledgeProposalError(error);
  }
}
