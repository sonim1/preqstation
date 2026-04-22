import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_PRIORITY_MAX,
  PROJECT_SETTING_KEY_MAX_LENGTH,
  PROJECT_SETTING_VALUE_MAX_LENGTH,
} from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects } from '@/lib/db/schema';
import { ENTITY_PROJECT, PROJECT_UPDATED, writeOutboxEvent } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { isValidBgValue } from '@/lib/project-backgrounds';
import { PROJECT_STATUSES } from '@/lib/project-meta';
import { normalizeProjectSettingsInput, setProjectSetting } from '@/lib/project-settings';
import { assertSameOrigin } from '@/lib/request-security';

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH).optional(),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX_LENGTH).optional().or(z.literal('')),
  repoUrl: z.string().url().optional().or(z.literal('')),
  vercelUrl: z.string().url().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(1).max(PROJECT_PRIORITY_MAX).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  bgImage: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || isValidBgValue(value), {
      message: 'bgImage must be a preset id or https:// URL',
    })
    .optional(),
  settings: z
    .record(
      z.string().trim().min(1).max(PROJECT_SETTING_KEY_MAX_LENGTH),
      z.string().trim().max(PROJECT_SETTING_VALUE_MAX_LENGTH),
    )
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if ('projectKey' in body) {
      return NextResponse.json(
        { error: 'Project key is immutable and cannot be edited.' },
        { status: 400 },
      );
    }
    const payload = updateProjectSchema.parse(body);
    const normalizedSettings = payload.settings
      ? normalizeProjectSettingsInput(payload.settings)
      : undefined;
    const changedFields = [
      payload.name !== undefined ? 'name' : null,
      payload.description !== undefined ? 'description' : null,
      payload.repoUrl !== undefined ? 'repoUrl' : null,
      payload.vercelUrl !== undefined ? 'vercelUrl' : null,
      payload.priority !== undefined ? 'priority' : null,
      payload.status !== undefined ? 'status' : null,
      payload.bgImage !== undefined ? 'bgImage' : null,
      ...(normalizedSettings ? Object.keys(normalizedSettings) : []),
    ].filter((field): field is string => field !== null);
    return await withOwnerDb(owner.id, async (client) => {
      const existing = await client.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.ownerId, owner.id), isNull(projects.deletedAt)),
        columns: { id: true, projectKey: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      const updated = await client
        .update(projects)
        .set({
          name: payload.name,
          description: payload.description === '' ? null : payload.description,
          repoUrl: payload.repoUrl === '' ? null : payload.repoUrl,
          vercelUrl: payload.vercelUrl === '' ? null : payload.vercelUrl,
          priority: payload.priority,
          status: payload.status,
          bgImage: payload.bgImage === '' ? null : payload.bgImage,
        })
        .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), isNull(projects.deletedAt)))
        .returning({ id: projects.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (normalizedSettings) {
        await Promise.all(
          Object.entries(normalizedSettings).map(([key, value]) =>
            setProjectSetting(existing.id, key, value, client),
          ),
        );
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'project.updated',
          targetType: 'project',
          targetId: id,
          meta: {
            projectKey: existing.projectKey,
            settings: normalizedSettings ? Object.keys(normalizedSettings) : undefined,
          },
        },
        client,
      );

      await writeOutboxEvent({
        tx: client,
        ownerId: owner.id,
        projectId: existing.id,
        eventType: PROJECT_UPDATED,
        entityType: ENTITY_PROJECT,
        entityId: existing.projectKey,
        payload: { fields: changedFields },
      });

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
