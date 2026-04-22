import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { createDispatchRequest } from '@/lib/dispatch-request-store';
import { ENGINE_KEYS } from '@/lib/engine-icons';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  projectKey: z.string().trim().min(1).max(20),
  engine: z.enum(ENGINE_KEYS).optional().or(z.literal('')),
  branchName: z.string().trim().optional().or(z.literal('')),
  insightPromptB64: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = sendSchema.parse(await req.json());

    const request = await createDispatchRequest({
      ownerId: owner.id,
      scope: 'project',
      objective: 'insight',
      projectKey: payload.projectKey,
      engine: payload.engine || null,
      dispatchTarget: 'claude-code-channel',
      branchName: payload.branchName || null,
      promptMetadata: {
        insightPromptB64: payload.insightPromptB64,
      },
    });

    await writeAuditLog({
      ownerId: owner.id,
      action: 'dispatch.claude_code_insight_queued',
      targetType: 'project',
      targetId: payload.projectKey,
      meta: {
        dispatchTarget: 'claude-code-channel',
        objective: 'insight',
        engine: payload.engine || null,
        branchName: payload.branchName || null,
        requestId: request?.id ?? null,
      },
    });

    return NextResponse.json({ ok: true, requestId: request?.id ?? null });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[api/dispatch/claude-code/insight] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to queue Claude Code insight dispatch' },
      { status: 500 },
    );
  }
}
