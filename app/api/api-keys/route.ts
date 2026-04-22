import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { issueApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import { API_TOKEN_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { apiTokens } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(API_TOKEN_NAME_MAX_LENGTH),
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export async function GET() {
  try {
    const owner = await requireOwnerUser();
    return await withOwnerDb(owner.id, async (client) => {
      const apiKeys = await client
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          tokenPrefix: apiTokens.tokenPrefix,
          lastUsedAt: apiTokens.lastUsedAt,
          expiresAt: apiTokens.expiresAt,
          revokedAt: apiTokens.revokedAt,
          createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.ownerId, owner.id))
        .orderBy(desc(apiTokens.createdAt));

      return NextResponse.json({ apiKeys });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = createApiKeySchema.parse(await req.json());
    const expiresAt = payload.expiresInDays
      ? new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return await withOwnerDb(owner.id, async (client) => {
      const { token, record } = await issueApiToken({
        ownerId: owner.id,
        name: payload.name,
        expiresAt,
      });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'api_token.created',
          targetType: 'api_token',
          targetId: record.id,
          meta: { name: record.name, expiresAt: record.expiresAt?.toISOString() ?? null },
        },
        client,
      );

      return NextResponse.json({ apiKey: record, token }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
