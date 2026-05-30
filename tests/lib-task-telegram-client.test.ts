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
        askHint: 'Summarize around acceptance criteria',
      }),
    ).toContain(
      '!/preqstation dispatch ask PROJ-328 using claude-code branch_name="task/proj-328/edit-note" ask_hint="Summarize around acceptance criteria"',
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
    ).toBe('!/preqstation dispatch comment PROJ-328 using codex comment_id="comment-123"');
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
      [
        '/preqstation_dispatch',
        'project_key=PROJ task_key=PROJ-328 objective=comment engine=claude-code comment_id=comment-123',
      ].join('\n'),
    );
  });

  it('keeps the configured Hermes bot id on Hermes comment dispatches', () => {
    expect(
      buildTaskCommentDispatchMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'claude-code',
        commentId: 'comment-123',
        dispatchTarget: 'hermes-telegram',
        hermesBotUsername: '@custom_hermes_bot',
      }),
    ).toContain('/preqstation_dispatch@custom_hermes_bot');
  });

  it('propagates model overrides through comment dispatch messages', () => {
    expect(
      buildTaskCommentDispatchMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'codex',
        model: 'gpt-5-codex',
        commentId: 'comment-123',
        dispatchTarget: 'telegram',
      }),
    ).toBe(
      '!/preqstation dispatch comment PROJ-328 using codex comment_id="comment-123" model="gpt-5-codex"',
    );

    expect(
      buildTaskCommentDispatchMessage({
        taskKey: 'PROJ-328',
        status: 'todo',
        engine: 'claude-code',
        model: 'sonnet',
        commentId: 'comment-123',
        dispatchTarget: 'hermes-telegram',
      }),
    ).toContain('model=sonnet');
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

    await sendTaskTelegramMessage('PROJ-328', '/preqstation_dispatch', 'hermes-telegram');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskKey: 'PROJ-328',
          message: '/preqstation_dispatch',
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
        insightPrompt: 'Break down the Connections page redesign',
      }),
    ).toContain('/preqstation_dispatch');
    expect(
      buildProjectInsightDispatchMessage({
        projectKey: 'PROJ',
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
        insightPrompt: 'Break down the Connections page redesign',
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
      '!/preqstation dispatch qa PROJ using gemini-cli branch_name="main" qa_run_id="run-123" qa_task_keys="PROJ-1,PROJ-2"',
    );
  });

  it('propagates model overrides through project insight and QA dispatch messages', () => {
    expect(
      buildProjectInsightDispatchMessage({
        projectKey: 'PROJ',
        engine: 'codex',
        model: 'gpt-5-codex',
        dispatchTarget: 'telegram',
      }),
    ).toBe('!/preqstation dispatch insight PROJ using codex model="gpt-5-codex"');

    expect(
      buildProjectQaDispatchMessage({
        projectKey: 'PROJ',
        engine: 'gemini-cli',
        model: 'gemini-2.5-pro',
        dispatchTarget: 'hermes-telegram',
      }),
    ).toContain('model=gemini-2.5-pro');
  });

  it('posts Hermes project insight sends with the Hermes dispatch target', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendProjectInsightTelegramMessage('PROJ', '/preqstation_dispatch', 'hermes-telegram');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/telegram/send/insight',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectKey: 'PROJ',
          message: '/preqstation_dispatch',
          dispatchTarget: 'hermes-telegram',
        }),
      }),
    );
  });
});
