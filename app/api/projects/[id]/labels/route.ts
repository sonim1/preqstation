import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { TODO_LABEL_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabels } from '@/lib/db/schema';
import { ENTITY_TASK_LABEL, TASK_LABEL_UPDATED, writeOutboxEventStandalone } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { listProjectTaskLabels } from '@/lib/task-labels';
import { normalizeTaskLabelColor } from '@/lib/task-meta';

const taskLabelColorSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeTaskLabelColor(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid label color',
      });
      return z.NEVER;
    }
    return normalized;
  });

const createTaskLabelSchema = z.object({
  name: z.string().trim().min(1).max(TODO_LABEL_NAME_MAX_LENGTH),
  color: taskLabelColorSchema.optional(),
});

async function findOwnedProject(
  ownerId: string,
  projectId: string,
  client: Parameters<Parameters<typeof withOwnerDb>[1]>[0],
) {
  return client.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.ownerId, ownerId),
      isNull(projects.deletedAt),
    ),
    columns: { id: true, ownerId: true, projectKey: true },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwnerUser();
    const { id } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const project = await findOwnedProject(owner.id, id, client);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const labels = await listProjectTaskLabels(owner.id, project.id, client);
      return NextResponse.json({ labels });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load labels' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;
    const payload = createTaskLabelSchema.parse(await req.json());

    return await withOwnerDb(owner.id, async (client) => {
      const project = await findOwnedProject(owner.id, id, client);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const [label] = await client
        .insert(taskLabels)
        .values({
          ownerId: owner.id,
          projectId: project.id,
          name: payload.name,
          color: payload.color || 'blue',
        })
        .returning();

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'todo_label.created',
          targetType: 'todo_label',
          targetId: label.id,
          meta: { projectId: project.id },
        },
        client,
      );

      await writeOutboxEventStandalone(
        {
          ownerId: owner.id,
          eventType: TASK_LABEL_UPDATED,
          entityType: ENTITY_TASK_LABEL,
          entityId: label.id,
          payload: { action: 'created', projectId: project.id },
        },
        client,
      );

      return NextResponse.json({ label }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}
