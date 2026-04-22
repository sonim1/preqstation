import { and, asc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, tasks } from '@/lib/db/schema';
import { DEFAULT_ENGINE_KEY, ENGINE_KEYS } from '@/lib/engine-icons';
import { buildOpenClawQaCommand } from '@/lib/openclaw-command';
import { requireOwnerUser } from '@/lib/owner';
import { getProjectSettings, PROJECT_SETTING_KEYS } from '@/lib/project-settings';
import {
  createQueuedQaRun,
  deleteQaRun,
  isMissingQaRunsRelationError,
  QA_RUNS_STORAGE_UNAVAILABLE_MESSAGE,
  qaRunsStorageAvailable,
} from '@/lib/qa-runs';
import { assertSameOrigin } from '@/lib/request-security';
import { sendTelegramMessage } from '@/lib/telegram';
import { decryptTelegramToken } from '@/lib/telegram-crypto';
import { getUserSettings, SETTING_KEYS } from '@/lib/user-settings';

const triggerQaRunSchema = z
  .object({
    engine: z.enum(ENGINE_KEYS).optional(),
  })
  .strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id } = await params;
    const payload = triggerQaRunSchema.parse(
      (await req.json().catch(() => ({}))) as Record<string, unknown>,
    );

    return await withOwnerDb(owner.id, async (client) => {
      const project = await client.query.projects.findFirst({
        where: and(eq(projects.id, id), eq(projects.ownerId, owner.id), isNull(projects.deletedAt)),
        columns: { id: true, name: true, projectKey: true },
      });
      if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const readyTasks = await client.query.tasks.findMany({
        where: and(
          eq(tasks.ownerId, owner.id),
          eq(tasks.projectId, project.id),
          eq(tasks.status, 'ready'),
        ),
        columns: { id: true, taskKey: true },
        orderBy: [asc(tasks.sortOrder), asc(tasks.createdAt)],
      });
      if (readyTasks.length === 0) {
        return NextResponse.json({ error: 'No ready tasks available for QA' }, { status: 400 });
      }

      if (!(await qaRunsStorageAvailable(client))) {
        return NextResponse.json({ error: QA_RUNS_STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
      }

      const projectSettings = await getProjectSettings(project.id, client);
      const branchName = projectSettings[PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH] || 'main';

      const settings = await getUserSettings(owner.id, client);
      const qaEngine = payload.engine ?? DEFAULT_ENGINE_KEY;
      const telegramEnabled = settings[SETTING_KEYS.TELEGRAM_ENABLED] === 'true';
      const encryptedToken = settings[SETTING_KEYS.TELEGRAM_BOT_TOKEN] || '';
      const chatId = settings[SETTING_KEYS.TELEGRAM_CHAT_ID] || '';
      if (!telegramEnabled || !encryptedToken || !chatId) {
        return NextResponse.json(
          { error: 'Telegram is not fully configured or disabled' },
          { status: 400 },
        );
      }

      let botToken = '';
      try {
        botToken = await decryptTelegramToken(encryptedToken);
      } catch (error) {
        console.error(
          '[api/projects/:id/qa-runs/trigger] failed to decrypt Telegram token:',
          error,
        );
        return NextResponse.json(
          { error: 'Telegram bot token is invalid. Save Telegram settings again.' },
          { status: 500 },
        );
      }

      const run = await createQueuedQaRun(
        {
          ownerId: owner.id,
          projectId: project.id,
          branchName,
          engine: qaEngine,
          taskKeys: readyTasks.map((task) => task.taskKey),
        },
        client,
      );

      const message = buildOpenClawQaCommand({
        projectKey: project.projectKey,
        engineKey: qaEngine,
        branchName,
        qaRunId: run.id,
        qaTaskKeys: run.taskKeys,
      });

      const sendResult = await sendTelegramMessage(botToken, chatId, message);
      if (!sendResult.ok) {
        await deleteQaRun(run.id, owner.id, client);
        return NextResponse.json(
          { error: sendResult.description || 'Failed to send Telegram message' },
          { status: 502 },
        );
      }

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'qa.run_queued',
          targetType: 'project',
          targetId: project.projectKey,
          meta: {
            projectId: project.id,
            qaRunId: run.id,
            branchName,
            taskKeys: run.taskKeys,
          },
        },
        client,
      );

      return NextResponse.json({ ok: true, run });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (isMissingQaRunsRelationError(error)) {
      return NextResponse.json({ error: QA_RUNS_STORAGE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
    console.error('[api/projects/:id/qa-runs/trigger] POST failed:', error);
    return NextResponse.json({ error: 'Failed to queue QA run' }, { status: 500 });
  }
}
