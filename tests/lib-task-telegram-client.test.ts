import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildProjectInsightDispatchMessage,
  buildProjectQaDispatchMessage,
  buildTaskTelegramMessage,
  sendProjectInsightTelegramMessage,
  sendTaskTelegramMessage,
} from '@/lib/task-telegram-client';

describe('lib/task-telegram-client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a telegram message with the selected objective', () => {
    expect(
      buildTaskTelegramMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'claude-code',
        branchName: 'task/proj-328/edit-note',
        objective: 'ask',
        askHint: 'Acceptance criteria 중심으로 정리해줘',
      }),
    ).toContain(
      '!/skill preqstation-dispatch ask PROJ-328 using claude-code branch_name="task/proj-328/edit-note" ask_hint="Acceptance criteria 중심으로 정리해줘"',
    );
  });

  it('posts task telegram sends to the telegram API route', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendTaskTelegramMessage('PROJ-328', 'hello telegram');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskKey: 'PROJ-328', message: 'hello telegram' }),
      }),
    );
  });

  it('posts Hermes task telegram sends with the Hermes dispatch target', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendTaskTelegramMessage('PROJ-328', '/preq_dispatch@PreqHermesBot', 'hermes-telegram');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskKey: 'PROJ-328',
          message: '/preq_dispatch@PreqHermesBot',
          dispatchTarget: 'hermes-telegram',
        }),
      }),
    );
  });

  it('builds Hermes project insight messages with encoded prompt metadata', () => {
    expect(
      buildProjectInsightDispatchMessage({
        projectKey: 'PROJ',
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('/preq_dispatch@PreqHermesBot');
    expect(
      buildProjectInsightDispatchMessage({
        projectKey: 'PROJ',
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('insight_prompt_b64=');
  });

  it('builds project QA messages with run metadata for Channels previews', () => {
    expect(
      buildProjectQaDispatchMessage({
        projectKey: 'PROJ',
        engine: 'gemini-cli',
        dispatchTarget: 'claude-code-channel',
        branchName: 'main',
        qaRunId: 'run-123',
        qaTaskKeys: ['PROJ-1', 'PROJ-2'],
      }),
    ).toBe(
      '!/skill preqstation-dispatch qa PROJ using gemini-cli branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
    );
  });

  it('posts Hermes project insight sends with the Hermes dispatch target', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendProjectInsightTelegramMessage(
      'PROJ',
      '/preq_dispatch@PreqHermesBot',
      'hermes-telegram',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send/insight',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectKey: 'PROJ',
          message: '/preq_dispatch@PreqHermesBot',
          dispatchTarget: 'hermes-telegram',
        }),
      }),
    );
  });
});
