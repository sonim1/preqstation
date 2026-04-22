import { sql } from 'drizzle-orm';

import { resolveDisplayTimeZone } from '@/lib/date-time';
import { db } from '@/lib/db';
import type { DbClientOrTx } from '@/lib/db/types';

export async function rebuildDashboardWorkLogRollups(
  ownerId: string,
  timeZone?: string | null,
  client: DbClientOrTx = db,
) {
  const resolvedTimeZone = resolveDisplayTimeZone(timeZone);

  await client.execute(
    sql`select dashboard_rebuild_work_log_rollups(${ownerId}::uuid, ${resolvedTimeZone})`,
  );
}
