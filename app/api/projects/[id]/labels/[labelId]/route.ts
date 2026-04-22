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

const updateTaskLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(TODO_LABEL_NAME_MAX_LENGTH).optional(),
    color: taskLabelColorSchema.optional(),
  })
  .refine((payload) => payload.name !== undefined || payload.color !== undefined, {
    message: 'At least one field is required',
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
    columns: { id: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id, labelId } = await params;
    const payload = updateTaskLabelSchema.parse(await req.json());

    const updateData: Record<string, unknown> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.color !== undefined) updateData.color = payload.color;

    return await withOwnerDb(owner.id, async (client) => {
      const project = await findOwnedProject(owner.id, id, client);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const updated = await client
        .update(taskLabels)
        .set(updateData)
        .where(
          and(
            eq(taskLabels.id, labelId),
            eq(taskLabels.ownerId, owner.id),
            eq(taskLabels.projectId, project.id),
          ),
        )
        .returning({ id: taskLabels.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'todo_label.updated',
          targetType: 'todo_label',
          targetId: labelId,
          meta: { projectId: project.id },
        },
        client,
      );

      await writeOutboxEventStandalone(
        {
          ownerId: owner.id,
          eventType: TASK_LABEL_UPDATED,
          entityType: ENTITY_TASK_LABEL,
          entityId: labelId,
          payload: { action: 'updated', projectId: project.id },
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id, labelId } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const project = await findOwnedProject(owner.id, id, client);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const deleted = await client
        .delete(taskLabels)
        .where(
          and(
            eq(taskLabels.id, labelId),
            eq(taskLabels.ownerId, owner.id),
            eq(taskLabels.projectId, project.id),
          ),
        )
        .returning({ id: taskLabels.id });

      if (deleted.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'todo_label.deleted',
          targetType: 'todo_label',
          targetId: labelId,
          meta: { projectId: project.id },
        },
        client,
      );

      await writeOutboxEventStandalone(
        {
          ownerId: owner.id,
          eventType: TASK_LABEL_UPDATED,
          entityType: ENTITY_TASK_LABEL,
          entityId: labelId,
          payload: { action: 'deleted', projectId: project.id },
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
