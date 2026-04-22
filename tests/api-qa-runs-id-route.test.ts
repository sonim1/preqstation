import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    authenticateApiToken: vi.fn(),
    updateQaRun: vi.fn(),
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/qa-runs', () => ({
  updateQaRun: mocked.updateQaRun,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, never>) => unknown) =>
    callback({}),
}));

import { PATCH } from '@/app/api/qa-runs/[id]/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/qa-runs/run-123`, {
    method: 'PATCH',
    headers: {
      authorization: 'Bearer preq_test_token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/qa-runs/[id]/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQ Token',
    });
    mocked.updateQaRun.mockResolvedValue({
      id: 'run-123',
      projectId: 'project-1',
      branchName: 'main',
      status: 'failed',
      engine: 'codex',
      targetUrl: 'http://127.0.0.1:3000',
      taskKeys: ['PROJ-1'],
      summary: { total: 2, critical: 0, high: 1, medium: 1, low: 0 },
      reportMarkdown: '# QA Report',
      createdAt: '2026-03-18T10:00:00.000Z',
      startedAt: '2026-03-18T10:01:00.000Z',
      finishedAt: '2026-03-18T10:03:00.000Z',
    });
  });

  it('returns 401 when bearer auth is missing', async () => {
    mocked.authenticateApiToken.mockResolvedValueOnce(null);

    const response = await PATCH(
      new Request(`${TEST_BASE_URL}/api/qa-runs/run-123`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'running' }),
      }),
      {
        params: Promise.resolve({ id: 'run-123' }),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('updates a QA run with markdown report data', async () => {
    const response = await PATCH(
      patchRequest({
        status: 'failed',
        target_url: 'http://127.0.0.1:3000',
        report_markdown: '# QA Report',
        summary: {
          total: 2,
          critical: 0,
          high: 1,
          medium: 1,
          low: 0,
        },
      }),
      {
        params: Promise.resolve({ id: 'run-123' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      run: expect.objectContaining({
        id: 'run-123',
        status: 'failed',
        reportMarkdown: '# QA Report',
      }),
    });
    expect(mocked.updateQaRun).toHaveBeenCalledWith(
      {
        id: 'run-123',
        ownerId: 'owner-1',
        status: 'failed',
        targetUrl: 'http://127.0.0.1:3000',
        reportMarkdown: '# QA Report',
        summary: {
          total: 2,
          critical: 0,
          high: 1,
          medium: 1,
          low: 0,
        },
      },
      expect.anything(),
    );
  });
});
