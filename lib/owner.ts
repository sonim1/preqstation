import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { withOwnerDb } from '@/lib/db/rls';
import { users } from '@/lib/db/schema';
import type { SelectUser } from '@/lib/db/types';
import { getRequestContext } from '@/lib/request-context';
import { writeSecurityEvent } from '@/lib/security-events';

function unauthorized(message = 'Unauthorized') {
  return new Response(message, { status: 401 });
}

async function upsertOwnerUser(userId: string): Promise<SelectUser> {
  return withOwnerDb(userId, async (client) => {
    const user = await client.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.isOwner) {
      throw unauthorized();
    }

    return user;
  });
}

export async function requireOwnerUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const userId = session?.user?.id;
  const ctx = await getRequestContext();

  if (!session?.user?.isOwner || !userId) {
    await writeSecurityEvent({
      actorEmail: email,
      eventType: 'authz.owner_check',
      outcome: 'blocked',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      path: ctx.path,
    });
    throw unauthorized();
  }
  if (!email) {
    throw unauthorized();
  }

  try {
    return await upsertOwnerUser(userId);
  } catch (error) {
    await writeSecurityEvent({
      actorEmail: email,
      eventType: 'authz.owner_mismatch',
      outcome: 'blocked',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      path: ctx.path,
    });
    throw error;
  }
}

export async function getOwnerUserOrNull() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const userId = session?.user?.id;
  if (!session?.user?.isOwner) return null;
  if (!email) return null;
  if (!userId) return null;
  try {
    return await upsertOwnerUser(userId);
  } catch (error) {
    console.error('[getOwnerUserOrNull] upsertOwnerUser failed:', error);
    return null;
  }
}
