import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    assertSameOrigin: vi.fn(),
    requireOwnerUser: vi.fn(),
    getProjectSettings: vi.fn(),
    getUserSettings: vi.fn(),
    decryptTelegramToken: vi.fn(),
    sendTelegramMessage: vi.fn(),
    writeAuditLog: vi.fn(),
    createDispatchRequest: vi.fn(),
    createQueuedQaRun: vi.fn(),
    deleteQaRun: vi.fn(),
    qaRunsStorageAvailable: vi.fn(),
    isMissingQaRunsRelationError: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
        tasks: { findMany: vi.fn() },
      },
    },
  };
});

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/project-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/project-settings')>('@/lib/project-settings');
  return {
    ...actual,
    getProjectSettings: mocked.getProjectSettings,
  };
});

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSettings: mocked.getUserSettings,
  };
});

vi.mock('@/lib/telegram-crypto', () => ({
  decryptTelegramToken: mocked.decryptTelegramToken,
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: mocked.sendTelegramMessage,
}));

vi.mock('@/lib/dispatch-request-store', () => ({
  createDispatchRequest: mocked.createDispatchRequest,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/qa-runs', () => ({
  createQueuedQaRun: mocked.createQueuedQaRun,
  deleteQaRun: mocked.deleteQaRun,
  qaRunsStorageAvailable: mocked.qaRunsStorageAvailable,
  isMissingQaRunsRelationError: mocked.isMissingQaRunsRelationError,
  QA_RUNS_STORAGE_UNAVAILABLE_MESSAGE: 'QA runs are unavailable until qa_runs migration is applied',
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { POST } from '@/app/api/projects/[id]/qa-runs/trigger/route';

function postRequest(body: Record<string, unknown> = {}) {
  return new Request(`${TEST_BASE_URL}/api/projects/project-1/qa-runs/trigger`, {
    method: 'POST',
    headers: {
      origin: TEST_BASE_URL,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/projects/[id]/qa-runs/trigger/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      projectKey: 'PROJ',
    });
    mocked.db.query.tasks.findMany.mockResolvedValue([
      { id: 'task-1', taskKey: 'PROJ-1' },
      { id: 'task-2', taskKey: 'PROJ-2' },
    ]);
    mocked.getProjectSettings.mockResolvedValue({
      deploy_default_branch: 'main',
    });
    mocked.getUserSettings.mockResolvedValue({
      engine_default: '',
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '123456',
    });
    mocked.decryptTelegramToken.mockResolvedValue('bot-token');
    mocked.sendTelegramMessage.mockResolvedValue({ ok: true });
    mocked.createDispatchRequest.mockResolvedValue({ id: 'dispatch-request-1' });
    mocked.qaRunsStorageAvailable.mockResolvedValue(true);
    mocked.isMissingQaRunsRelationError.mockReturnValue(false);
    mocked.createQueuedQaRun.mockResolvedValue({
      id: 'run-123',
      projectId: 'project-1',
      branchName: 'main',
      status: 'queued',
      engine: 'claude-code',
      targetUrl: null,
      taskKeys: ['PROJ-1', 'PROJ-2'],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      reportMarkdown: null,
      createdAt: '2026-03-18T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    mocked.writeAuditLog.mockResolvedValue(undefined);
  });

  it('creates a queued QA run and sends the Telegram command', async () => {
    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      run: expect.objectContaining({
        id: 'run-123',
        branchName: 'main',
        taskKeys: ['PROJ-1', 'PROJ-2'],
      }),
    });
    expect(mocked.createQueuedQaRun).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        projectId: 'project-1',
        branchName: 'main',
        engine: 'claude-code',
        taskKeys: ['PROJ-1', 'PROJ-2'],
      },
      expect.anything(),
    );
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      'bot-token',
      '123456',
      '!/skill preqstation-dispatch qa PROJ using claude-code branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
      { normalizeCommand: true },
    );
    expect(mocked.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        action: 'qa.run_queued',
        targetType: 'project',
        targetId: 'PROJ',
      }),
      expect.anything(),
    );
  });

  it('uses the request body engine when provided', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      engine_default: 'codex',
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '123456',
    });

    await POST(postRequest({ engine: 'gemini-cli' }), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(mocked.createQueuedQaRun).toHaveBeenCalledWith(
      expect.objectContaining({ engine: 'gemini-cli' }),
      expect.anything(),
    );
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      'bot-token',
      '123456',
      '!/skill preqstation-dispatch qa PROJ using gemini-cli branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
      { normalizeCommand: true },
    );
  });

  it('sends Hermes QA commands through the Hermes Telegram channel when requested', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      engine_default: 'codex',
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '123456',
      openclaw_telegram_enabled: 'true',
      openclaw_telegram_chat_id: '123456',
      hermes_telegram_enabled: 'true',
      hermes_telegram_chat_id: '7654321',
    });

    await POST(postRequest({ engine: 'codex', dispatchTarget: 'hermes-telegram' }), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      'bot-token',
      '7654321',
      [
        '/preq_dispatch@PreqHermesBot',
        'project_key=PROJ',
        'objective=qa',
        'engine=codex',
        'branch_name=main',
        'qa_run_id=run-123',
        'qa_task_keys=PROJ-1,PROJ-2',
      ].join('\n'),
      { normalizeCommand: false },
    );
    expect(mocked.createDispatchRequest).not.toHaveBeenCalled();
  });

  it('creates a project-scope Channels dispatch request when QA targets Channels', async () => {
    const response = await POST(
      postRequest({ engine: 'codex', dispatchTarget: 'claude-code-channel' }),
      {
        params: Promise.resolve({ id: 'project-1' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocked.sendTelegramMessage).not.toHaveBeenCalled();
    expect(mocked.createDispatchRequest).toHaveBeenCalledWith(
      {
        ownerId: 'owner-1',
        scope: 'project',
        objective: 'qa',
        projectKey: 'PROJ',
        engine: 'codex',
        dispatchTarget: 'claude-code-channel',
        branchName: 'main',
        promptMetadata: {
          qaRunId: 'run-123',
          qaTaskKeys: ['PROJ-1', 'PROJ-2'],
        },
      },
      expect.anything(),
    );
  });

  it('falls back to Claude Code when no request engine is provided', async () => {
    mocked.getUserSettings.mockResolvedValueOnce({
      engine_default: 'codex',
      telegram_enabled: 'true',
      telegram_bot_token: 'encrypted-token',
      telegram_chat_id: '123456',
    });

    await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(mocked.createQueuedQaRun).toHaveBeenCalledWith(
      expect.objectContaining({ engine: 'claude-code' }),
      expect.anything(),
    );
    expect(mocked.sendTelegramMessage).toHaveBeenCalledWith(
      'bot-token',
      '123456',
      '!/skill preqstation-dispatch qa PROJ using claude-code branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
      { normalizeCommand: true },
    );
  });

  it('returns 400 when the project has no ready tasks', async () => {
    mocked.db.query.tasks.findMany.mockResolvedValueOnce([]);

    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'No ready tasks available for QA' });
    expect(mocked.createQueuedQaRun).not.toHaveBeenCalled();
  });

  it('returns a clear 503 when QA run storage is unavailable', async () => {
    mocked.qaRunsStorageAvailable.mockResolvedValueOnce(false);

    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: 'project-1' }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'QA runs are unavailable until qa_runs migration is applied',
    });
    expect(mocked.sendTelegramMessage).not.toHaveBeenCalled();
  });
});
