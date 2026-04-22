import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { WORK_LOG_DETAIL_MAX_LENGTH, WORK_LOG_TITLE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, workLogs } from '@/lib/db/schema';
import {
  ENTITY_WORKLOG,
  WORKLOG_DELETED,
  WORKLOG_UPDATED,
  writeOutboxEvent,
  writeOutboxEventStandalone,
} from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';

const updateWorkLogSchema = z.object({
  title: z.string().trim().min(1).max(WORK_LOG_TITLE_MAX_LENGTH).optional(),
  detail: z.string().trim().max(WORK_LOG_DETAIL_MAX_LENGTH).optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  workedAt: z.string().datetime().optional().or(z.literal('')),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwnerUser();
    const { id } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const workLog = await client.query.workLogs.findFirst({
        where: and(eq(workLogs.id, id), eq(workLogs.ownerId, owner.id)),
        columns: { id: true, title: true, detail: true },
      });

      if (!workLog) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({ workLog });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load work log' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;
    const payload = updateWorkLogSchema.parse(await req.json());

    return await withOwnerDb(owner.id, async (client) => {
      if (payload.projectId) {
        const project = await client.query.projects.findFirst({
          where: and(
            eq(projects.id, payload.projectId),
            eq(projects.ownerId, owner.id),
            isNull(projects.deletedAt),
          ),
          columns: { id: true },
        });
        if (!project) {
          return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }
      }

      const data: Record<string, unknown> = {};
      if (payload.title !== undefined) data.title = payload.title;
      if (payload.detail !== undefined) data.detail = payload.detail === '' ? null : payload.detail;
      if (payload.projectId !== undefined)
        data.projectId = payload.projectId === '' ? null : payload.projectId;
      if (payload.workedAt !== undefined)
        data.workedAt =
          payload.workedAt === ''
            ? new Date()
            : payload.workedAt
              ? new Date(payload.workedAt)
              : undefined;

      const updated = await client
        .update(workLogs)
        .set(data)
        .where(and(eq(workLogs.id, id), eq(workLogs.ownerId, owner.id)))
        .returning({ id: workLogs.id });

      if (updated.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'work_log.updated',
          targetType: 'work_log',
          targetId: id,
        },
        client,
      );

      await writeOutboxEventStandalone(
        {
          ownerId: owner.id,
          projectId: payload.projectId === '' ? null : payload.projectId,
          eventType: WORKLOG_UPDATED,
          entityType: ENTITY_WORKLOG,
          entityId: id,
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
    return NextResponse.json({ error: 'Failed to update work log' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const existing = await client.query.workLogs.findFirst({
        where: and(eq(workLogs.id, id), eq(workLogs.ownerId, owner.id)),
        columns: { id: true, projectId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await client.delete(workLogs).where(eq(workLogs.id, existing.id));
      await writeOutboxEvent({
        tx: client,
        ownerId: owner.id,
        projectId: existing.projectId,
        eventType: WORKLOG_DELETED,
        entityType: ENTITY_WORKLOG,
        entityId: existing.id,
      });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'work_log.deleted',
          targetType: 'work_log',
          targetId: id,
        },
        client,
      );

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to delete work log' }, { status: 500 });
  }
}
