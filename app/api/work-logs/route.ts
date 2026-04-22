import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { WORK_LOG_DETAIL_MAX_LENGTH, WORK_LOG_TITLE_MAX_LENGTH } from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, workLogs } from '@/lib/db/schema';
import { ENTITY_WORKLOG, WORKLOG_CREATED, writeOutboxEvent } from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { listWorkLogsPage } from '@/lib/work-log-list';
import { DEFAULT_WORK_LOG_PAGE_SIZE } from '@/lib/work-log-pagination';

const createWorkLogSchema = z.object({
  title: z.string().trim().min(1).max(WORK_LOG_TITLE_MAX_LENGTH),
  detail: z.string().trim().max(WORK_LOG_DETAIL_MAX_LENGTH).optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  workedAt: z.string().datetime().optional().or(z.literal('')),
});

const listWorkLogsQuerySchema = z.object({
  projectId: z.string().uuid().optional().or(z.literal('')),
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(DEFAULT_WORK_LOG_PAGE_SIZE)
    .optional()
    .default(DEFAULT_WORK_LOG_PAGE_SIZE),
});

export async function GET(req: Request) {
  try {
    const owner = await requireOwnerUser();
    const query = listWorkLogsQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );
    return await withOwnerDb(owner.id, async (client) => {
      const page = await listWorkLogsPage({
        ownerId: owner.id,
        projectId: query.projectId || null,
        offset: query.offset,
        limit: query.limit,
        includeProject: !query.projectId,
        client,
      });

      if (query.projectId) {
        return NextResponse.json(page);
      }

      return NextResponse.json({ workLogs: page.workLogs });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to load work logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const payload = createWorkLogSchema.parse(await req.json());

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

      const [workLog] = await client
        .insert(workLogs)
        .values({
          ownerId: owner.id,
          projectId: payload.projectId || null,
          title: payload.title,
          detail: payload.detail || null,
          workedAt: payload.workedAt ? new Date(payload.workedAt) : new Date(),
        })
        .returning();

      await writeOutboxEvent({
        tx: client,
        ownerId: owner.id,
        projectId: workLog.projectId,
        eventType: WORKLOG_CREATED,
        entityType: ENTITY_WORKLOG,
        entityId: workLog.id,
        payload: { title: payload.title },
      });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'work_log.created',
          targetType: 'work_log',
          targetId: workLog.id,
          meta: { projectId: workLog.projectId },
        },
        client,
      );

      return NextResponse.json({ workLog }, { status: 201 });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create work log' }, { status: 500 });
  }
}
