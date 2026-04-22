import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { authenticateApiToken } from '@/lib/api-tokens';
import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { normalizeProjectKey } from '@/lib/project-key';
import { getProjectSettings } from '@/lib/project-settings';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const projectKey = normalizeProjectKey(id);
    if (!projectKey) {
      return NextResponse.json({ error: 'Invalid project key' }, { status: 400 });
    }

    return await withOwnerDb(auth.ownerId, async (client) => {
      const project = await client.query.projects.findFirst({
        where: and(
          eq(projects.ownerId, auth.ownerId),
          eq(projects.projectKey, projectKey),
          isNull(projects.deletedAt),
        ),
        columns: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const settings = await getProjectSettings(project.id, client);
      return NextResponse.json({ settings });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load project settings' }, { status: 500 });
  }
}
