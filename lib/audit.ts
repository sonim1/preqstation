import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

type AuditParams = {
  ownerId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  meta?: unknown;
};

export async function writeAuditLog(params: AuditParams, client: DbClientOrTx = db) {
  try {
    await client.insert(auditLogs).values({
      ownerId: params.ownerId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      meta: params.meta,
    });
  } catch {
    // Do not propagate audit logging failures to core service flows.
  }
}
