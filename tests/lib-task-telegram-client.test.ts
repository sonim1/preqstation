import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTaskTelegramMessage, sendTaskTelegramMessage } from '@/lib/task-telegram-client';

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
});
