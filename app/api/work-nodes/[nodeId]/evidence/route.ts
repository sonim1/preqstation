import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import {
  authenticateWorkGraphRequest,
  handleWorkGraphError,
  workGraphAuditAction,
  workGraphAuditMeta,
  workGraphError,
  workGraphOk,
} from '@/lib/work-graph-api';
import { attachWorkNodeEvidence } from '@/lib/work-graph-service';

const evidenceSchema = z.object({
  kind: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  artifactUrl: z.string().optional().nullable(),
  artifact_url: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const auth = await authenticateWorkGraphRequest(req);
    if (!auth) return workGraphError('unauthorized', 'Unauthorized', 401);
    const parsed = evidenceSchema.safeParse(await req.json());
    if (!parsed.success) return workGraphError('invalid_request', 'Invalid request', 400);
    const { nodeId } = await params;

    return withOwnerDb(auth.ownerId, async (client) => {
      const input = parsed.data;
      const evidence = await attachWorkNodeEvidence({
        client,
        ownerId: auth.ownerId,
        nodeId,
        input: {
          kind: input.kind,
          title: input.title,
          summary: input.summary,
          payload: input.payload,
          artifactUrl: input.artifact_url ?? input.artifactUrl,
        },
        actorLabel: auth.tokenName ?? auth.ownerEmail,
      });
      await writeAuditLog(
        {
          ownerId: auth.ownerId,
          action: workGraphAuditAction('work_node.evidence_attached', auth),
          targetType: 'work_node',
          targetId: nodeId,
          meta: { ...workGraphAuditMeta(auth), evidenceId: evidence?.id },
        },
        client,
      );

      return workGraphOk({ evidence }, { status: 201 });
    });
  } catch (error) {
    return handleWorkGraphError(error);
  }
}
