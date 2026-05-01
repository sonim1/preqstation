import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildProjectInsightDispatchMessage,
  buildProjectQaDispatchMessage,
  buildTaskCommentDispatchMessage,
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

  it('builds OpenClaw comment dispatch messages with comment metadata', () => {
    expect(
      buildTaskCommentDispatchMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'codex',
        commentId: 'comment-123',
        dispatchTarget: 'telegram',
      }),
    ).toBe('!/skill preqstation-dispatch comment PROJ-328 using codex comment_id="comment-123"');
  });

  it('builds Hermes comment dispatch messages with comment metadata', () => {
    expect(
      buildTaskCommentDispatchMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'claude-code',
        commentId: 'comment-123',
        dispatchTarget: 'hermes-telegram',
      }),
    ).toBe(
      '/preqstation_dispatch@PreqHermesBot\nproject_key=PROJ\ntask_key=PROJ-328\nobjective=comment\nengine=claude-code\ncomment_id=comment-123',
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

    await sendTaskTelegramMessage(
      'PROJ-328',
      '/preqstation_dispatch@PreqHermesBot',
      'hermes-telegram',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskKey: 'PROJ-328',
          message: '/preqstation_dispatch@PreqHermesBot',
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
    ).toContain('/preqstation_dispatch@PreqHermesBot');
    expect(
      buildProjectInsightDispatchMessage({
        projectKey: 'PROJ',
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        insightPrompt: 'Connections 페이지 개편 작업을 나눠줘',
      }),
    ).toContain('insight_prompt_b64=');
  });

  it('builds project QA messages with run metadata for OpenClaw previews', () => {
    expect(
      buildProjectQaDispatchMessage({
        projectKey: 'PROJ',
        engine: 'gemini-cli',
        dispatchTarget: 'telegram',
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
      '/preqstation_dispatch@PreqHermesBot',
      'hermes-telegram',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send/insight',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectKey: 'PROJ',
          message: '/preqstation_dispatch@PreqHermesBot',
          dispatchTarget: 'hermes-telegram',
        }),
      }),
    );
  });
});
