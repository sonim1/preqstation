import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { apiTokens } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

const updateApiKeySchema = z.object({
  action: z.enum(['revoke', 'restore']),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;
    const payload = updateApiKeySchema.parse(await req.json());
    const revokedAt = payload.action === 'revoke' ? new Date() : null;

    return await withOwnerDb(owner.id, async (client) => {
      const updated = await client
        .update(apiTokens)
        .set({ revokedAt })
        .where(and(eq(apiTokens.id, id), eq(apiTokens.ownerId, owner.id)))
        .returning({ id: apiTokens.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: payload.action === 'revoke' ? 'api_token.revoked' : 'api_token.restored',
          targetType: 'api_token',
          targetId: id,
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const deleted = await client
        .delete(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.ownerId, owner.id)))
        .returning({ id: apiTokens.id });

      if (deleted.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'api_token.deleted',
          targetType: 'api_token',
          targetId: id,
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
