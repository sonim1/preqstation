import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';
import { normalizeProjectKey } from '@/lib/project-key';

export async function resolveProjectByKey(ownerId: string, key: string, client: DbClientOrTx = db) {
  const normalized = normalizeProjectKey(key);
  if (!normalized) return null;

  const project = await client.query.projects.findFirst({
    where: and(
      eq(projects.ownerId, ownerId),
      eq(projects.projectKey, normalized),
      isNull(projects.deletedAt),
    ),
    columns: {
      id: true,
      name: true,
      projectKey: true,
      bgImage: true,
      bgImageCredit: true,
    },
  });

  return project;
}
