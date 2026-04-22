import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  queueClaudeCodeDispatch,
  queueClaudeCodeInsightDispatch,
} from '@/lib/task-dispatch-client';

describe('lib/task-dispatch-client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes explicit ask metadata for Claude Code task dispatch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await queueClaudeCodeDispatch({
      taskKey: 'PROJ-328',
      engine: 'claude-code',
      branchName: 'task/proj-328/edit-note',
      objective: 'ask',
      askHint: 'Acceptance criteria 중심으로 정리해줘',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dispatch/claude-code',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskKey: 'PROJ-328',
          engine: 'claude-code',
          branchName: 'task/proj-328/edit-note',
          objective: 'ask',
          askHint: 'Acceptance criteria 중심으로 정리해줘',
        }),
      }),
    );
  });

  it('queues project-level insight dispatch for Claude Code', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await queueClaudeCodeInsightDispatch({
      projectKey: 'PROJ',
      engine: 'claude-code',
      branchName: 'preqstation/proj',
      insightPromptB64: 'cHJvbXB0LWJhc2U2NA==',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dispatch/claude-code/insight',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectKey: 'PROJ',
          engine: 'claude-code',
          branchName: 'preqstation/proj',
          insightPromptB64: 'cHJvbXB0LWJhc2U2NA==',
        }),
      }),
    );
  });
});
