import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { knowledgeUpdateProposals, tasks, taskWorkNodes } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

export const KNOWLEDGE_PROPOSAL_STATUSES = ['pending', 'applied', 'rejected'] as const;
export type KnowledgeProposalStatus = (typeof KNOWLEDGE_PROPOSAL_STATUSES)[number];

export class KnowledgeProposalError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'KnowledgeProposalError';
  }
}

export type CreateKnowledgeProposalInput = {
  target: string;
  body: string;
  rationale?: string | null;
  sourceNodeId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function requireProposalStatus(value: string): KnowledgeProposalStatus {
  if (KNOWLEDGE_PROPOSAL_STATUSES.includes(value as KnowledgeProposalStatus)) {
    return value as KnowledgeProposalStatus;
  }
  throw new KnowledgeProposalError('invalid_status', 'Invalid proposal status.');
}

async function findTaskOrThrow(params: {
  client: DbClientOrTx;
  ownerId: string;
  taskId: string;
}) {
  const task = await params.client.query.tasks.findFirst({
    where: and(eq(tasks.ownerId, params.ownerId), eq(tasks.id, params.taskId)),
    columns: { id: true, ownerId: true, projectId: true },
  });

  if (!task) throw new KnowledgeProposalError('not_found', 'Task not found.', 404);
  return task;
}

export async function listKnowledgeProposals({
  client = db,
  ownerId,
  taskId,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
}) {
  return client.query.knowledgeUpdateProposals.findMany({
    where: and(
      eq(knowledgeUpdateProposals.ownerId, ownerId),
      eq(knowledgeUpdateProposals.taskId, taskId),
    ),
    orderBy: [desc(knowledgeUpdateProposals.createdAt)],
  });
}

export async function createKnowledgeProposal({
  client = db,
  ownerId,
  taskId,
  input,
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
  input: CreateKnowledgeProposalInput;
}) {
  const task = await findTaskOrThrow({ client, ownerId, taskId });
  const target = input.target.trim();
  const body = input.body.trim();

  if (!target || target.length > 500) {
    throw new KnowledgeProposalError(
      'invalid_target',
      'Proposal target must be 1-500 characters.',
    );
  }
  if (!body) throw new KnowledgeProposalError('invalid_body', 'Proposal body is required.');

  if (input.sourceNodeId) {
    const sourceNode = await client.query.taskWorkNodes.findFirst({
      where: and(
        eq(taskWorkNodes.ownerId, ownerId),
        eq(taskWorkNodes.id, input.sourceNodeId),
        eq(taskWorkNodes.taskId, task.id),
      ),
      columns: { id: true },
    });
    if (!sourceNode) {
      throw new KnowledgeProposalError('invalid_source_node', 'Source node not found.');
    }
  }

  const [proposal] = await client
    .insert(knowledgeUpdateProposals)
    .values({
      ownerId,
      projectId: task.projectId,
      taskId: task.id,
      sourceNodeId: input.sourceNodeId ?? null,
      target,
      body,
      rationale: input.rationale?.trim() || null,
      status: 'pending',
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!proposal) {
    throw new KnowledgeProposalError('insert_failed', 'Failed to create knowledge proposal.', 500);
  }

  return proposal;
}

export async function updateKnowledgeProposalStatus({
  client = db,
  ownerId,
  taskId,
  proposalId,
  status,
  now = new Date(),
}: {
  client?: DbClientOrTx;
  ownerId: string;
  taskId: string;
  proposalId: string;
  status: string;
  now?: Date;
}) {
  const nextStatus = requireProposalStatus(status);
  if (nextStatus === 'pending') {
    throw new KnowledgeProposalError('invalid_status', 'Cannot return proposal to pending.');
  }

  const [proposal] = await client
    .update(knowledgeUpdateProposals)
    .set({ status: nextStatus, updatedAt: now })
    .where(
      and(
        eq(knowledgeUpdateProposals.ownerId, ownerId),
        eq(knowledgeUpdateProposals.taskId, taskId),
        eq(knowledgeUpdateProposals.id, proposalId),
      ),
    )
    .returning();

  if (!proposal) throw new KnowledgeProposalError('not_found', 'Knowledge proposal not found.', 404);
  return proposal;
}
