import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { writeAuditLog } from '@/lib/audit';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_PRIORITY_MAX,
} from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { requireOwnerUser } from '@/lib/owner';
import {
  assertValidProjectKeyInput,
  inferDefaultProjectKeyFromName,
  isProjectKeyTaken,
  isProjectKeyUniqueConstraintError,
  ProjectKeyConflictError,
  ProjectKeyValidationError,
  resolveUniqueProjectKey,
} from '@/lib/project-key';
import { assertSameOrigin } from '@/lib/request-security';

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH),
  projectKey: z.string().trim().max(16).optional().or(z.literal('')),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX_LENGTH).optional().or(z.literal('')),
  repoUrl: z.string().url().optional().or(z.literal('')),
  vercelUrl: z.string().url().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(1).max(PROJECT_PRIORITY_MAX).optional(),
});

export async function GET(_req?: Request) {
  try {
    const apiAuth = _req ? await authenticateApiToken(_req) : null;
    const ownerId = apiAuth?.ownerId || (await requireOwnerUser()).id;

    return await withOwnerDb(ownerId, async (client) => {
      const allProjects = await client.query.projects.findMany({
        where: and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)),
        orderBy: [asc(projects.status), desc(projects.updatedAt)],
      });

      return NextResponse.json({ projects: allProjects });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = createProjectSchema.parse(await req.json());
    return await withOwnerDb(owner.id, async (client) => {
      const requestedProjectKey = (payload.projectKey || '').trim();
      let projectKey = '';

      if (requestedProjectKey) {
        projectKey = assertValidProjectKeyInput(requestedProjectKey);
        if (await isProjectKeyTaken(owner.id, projectKey, client)) {
          return NextResponse.json({ error: 'Project key already exists.' }, { status: 409 });
        }
      } else {
        const inferredProjectKey = inferDefaultProjectKeyFromName(payload.name);
        projectKey = await resolveUniqueProjectKey(owner.id, inferredProjectKey, client);
      }

      const [project] = await client
        .insert(projects)
        .values({
          ownerId: owner.id,
          projectKey,
          name: payload.name,
          description: payload.description || null,
          repoUrl: payload.repoUrl || null,
          vercelUrl: payload.vercelUrl || null,
          priority: payload.priority ?? 2,
        })
        .returning();

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'project.created',
          targetType: 'project',
          targetId: project.id,
          meta: { projectKey: project.projectKey },
        },
        client,
      );

      return NextResponse.json({ project }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProjectKeyValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ProjectKeyConflictError || isProjectKeyUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Project key already exists.' }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
