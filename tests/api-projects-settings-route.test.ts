import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  return {
    authenticateApiToken: vi.fn(),
    getProjectSettings: vi.fn(),
    db: {
      query: {
        projects: { findFirst: vi.fn() },
      },
    },
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/project-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/project-settings')>('@/lib/project-settings');
  return {
    ...actual,
    getProjectSettings: mocked.getProjectSettings,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    callback(mocked.db),
}));

import { GET } from '@/app/api/projects/[id]/settings/route';

function getRequest(path: string) {
  return new Request(`${TEST_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      authorization: 'Bearer preq_test_token',
    },
  });
}

describe('app/api/projects/[id]/settings/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.authenticateApiToken.mockResolvedValue({
      ownerId: 'owner-1',
      ownerEmail: 'owner@example.com',
      tokenId: 'token-1',
      tokenName: 'PREQ Token',
    });
    mocked.db.query.projects.findFirst.mockResolvedValue({ id: 'project-1' });
    mocked.getProjectSettings.mockResolvedValue({
      deploy_strategy: 'feature_branch',
      deploy_default_branch: 'main',
      deploy_auto_pr: 'false',
      deploy_commit_on_review: 'true',
      agent_instructions: 'Always answer in Korean unless asked otherwise.',
    });
  });

  it('returns 401 when bearer token is missing/invalid', async () => {
    mocked.authenticateApiToken.mockResolvedValueOnce(null);

    const response = await GET(getRequest('/api/projects/PROJ/settings'), {
      params: Promise.resolve({ id: 'PROJ' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocked.db.query.projects.findFirst).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid project key', async () => {
    const response = await GET(getRequest('/api/projects/@@/settings'), {
      params: Promise.resolve({ id: '@@' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid project key' });
  });

  it('returns 404 when project key is not found', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const response = await GET(getRequest('/api/projects/PROJ/settings'), {
      params: Promise.resolve({ id: 'PROJ' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('returns settings for authenticated project owner', async () => {
    const response = await GET(getRequest('/api/projects/PROJ/settings'), {
      params: Promise.resolve({ id: 'PROJ' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: {
        deploy_strategy: 'feature_branch',
        deploy_default_branch: 'main',
        deploy_auto_pr: 'false',
        deploy_commit_on_review: 'true',
        agent_instructions: 'Always answer in Korean unless asked otherwise.',
      },
    });
    expect(mocked.db.query.projects.findFirst).toHaveBeenCalled();
    expect(mocked.getProjectSettings).toHaveBeenCalledWith('project-1', expect.anything());
  });
});
