import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticateApiToken } from '@/lib/api-tokens';
import { withOwnerDb } from '@/lib/db/rls';
import { updateQaRun } from '@/lib/qa-runs';

const summarySchema = z.object({
  total: z.number().int().min(0),
  critical: z.number().int().min(0),
  high: z.number().int().min(0),
  medium: z.number().int().min(0),
  low: z.number().int().min(0),
});

const updateSchema = z.object({
  status: z.enum(['running', 'passed', 'failed']).optional(),
  target_url: z.string().trim().url().optional().or(z.literal('')),
  report_markdown: z.string().optional().or(z.literal('')),
  summary: summarySchema.optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiToken(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const payload = updateSchema.parse(await req.json());

    return await withOwnerDb(auth.ownerId, async (client) => {
      const run = await updateQaRun(
        {
          id,
          ownerId: auth.ownerId,
          status: payload.status,
          targetUrl:
            payload.target_url === undefined
              ? undefined
              : payload.target_url
                ? payload.target_url
                : null,
          reportMarkdown:
            payload.report_markdown === undefined
              ? undefined
              : payload.report_markdown
                ? payload.report_markdown
                : null,
          summary: payload.summary,
        },
        client,
      );

      if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ run });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    console.error('[api/qa-runs/:id] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update QA run' }, { status: 500 });
  }
}
