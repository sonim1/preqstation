import { sql } from 'drizzle-orm';

import { resolveDisplayTimeZone } from '@/lib/date-time';
import { adminDb, db } from '@/lib/db';
import type { DbClient, DbTransaction } from '@/lib/db/types';

export async function withAdminDb<T>(callback: (client: DbClient) => Promise<T>) {
  return callback(adminDb);
}

export async function withOwnerDb<T>(
  ownerId: string,
  callback: (client: DbTransaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select
        set_config('app.user_id', ${ownerId}, true),
        set_config('app.default_timezone', ${resolveDisplayTimeZone()}, true)`,
    );
    return callback(tx);
  });
}
