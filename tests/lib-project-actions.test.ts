import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const updateWhereFn = vi.fn();
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const insertReturningFn = vi.fn();
  const insertValuesFn = vi.fn().mockReturnValue({ returning: insertReturningFn });
  const txInsertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  return {
    db: {
      query: {
        projects: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue({ set: updateSetFn }),
      transaction: vi.fn(),
    },
    updateSetFn,
    updateWhereFn,
    insertReturningFn,
    insertValuesFn,
    txInsertFn,
  };
});

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_PROJECT: 'project',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  writeOutboxEvent: vi.fn(),
}));

vi.mock('@/lib/project-key', () => ({
  assertValidProjectKeyInput: vi.fn(),
  inferDefaultProjectKeyFromName: vi.fn(),
  isProjectKeyTaken: vi.fn(),
  isProjectKeyUniqueConstraintError: vi.fn(() => false),
  ProjectKeyConflictError: class ProjectKeyConflictError extends Error {},
  ProjectKeyValidationError: class ProjectKeyValidationError extends Error {},
  resolveUniqueProjectKey: vi.fn(),
}));

vi.mock('@/lib/project-settings', () => ({
  PROJECT_SETTING_KEYS: {
    AGENT_INSTRUCTIONS: 'agent_instructions',
    DEPLOY_AUTO_PR: 'deploy_auto_pr',
    DEPLOY_COMMIT_ON_REVIEW: 'deploy_commit_on_review',
    DEPLOY_DEFAULT_BRANCH: 'deploy_default_branch',
    DEPLOY_SQUASH_MERGE: 'deploy_squash_merge',
    DEPLOY_STRATEGY: 'deploy_strategy',
  },
  resolveDeployStrategyConfig: vi.fn(),
  setProjectSetting: vi.fn(),
}));

import {
  createProject,
  updateProject,
  updateProjectAgentInstructions,
  updateProjectDeploySettings,
} from '@/lib/actions/project-actions';
import { PROJECT_UPDATED, writeOutboxEvent } from '@/lib/outbox';
import {
  assertValidProjectKeyInput,
  inferDefaultProjectKeyFromName,
  isProjectKeyTaken,
  resolveUniqueProjectKey,
} from '@/lib/project-key';
import { resolveDeployStrategyConfig, setProjectSetting } from '@/lib/project-settings';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OPENVERSE_BG_IMAGE = 'https://cdn.openverse.org/forest-road.jpg';
const OPENVERSE_BG_CREDIT = {
  provider: 'openverse',
  creatorName: 'Jane Doe',
  creatorUrl: 'https://example.com/jane',
  sourceName: 'Flickr',
  sourceUrl: 'https://example.com/photo-1',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

describe('lib/actions/project-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.db.update.mockReturnValue({ set: mocked.updateSetFn });
    mocked.updateSetFn.mockReturnValue({ where: mocked.updateWhereFn });
    mocked.updateWhereFn.mockResolvedValue({ count: 1 });
    mocked.txInsertFn.mockReturnValue({ values: mocked.insertValuesFn });
    mocked.insertValuesFn.mockReturnValue({ returning: mocked.insertReturningFn });
    mocked.insertReturningFn.mockResolvedValue([{ id: PROJECT_ID, projectKey: 'PROJ' }]);
    mocked.db.transaction.mockImplementation(async (callback) =>
      callback({ insert: mocked.txInsertFn }),
    );
    vi.mocked(assertValidProjectKeyInput).mockImplementation((value) =>
      String(value).toUpperCase(),
    );
    vi.mocked(inferDefaultProjectKeyFromName).mockReturnValue('PREQ');
    vi.mocked(isProjectKeyTaken).mockResolvedValue(false);
    vi.mocked(resolveUniqueProjectKey).mockResolvedValue('PROJ');
    vi.mocked(resolveDeployStrategyConfig).mockReturnValue({
      strategy: 'feature_branch',
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: false,
    });
    vi.mocked(writeOutboxEvent).mockResolvedValue(undefined);
  });

  it('updateProject skips the database update when the submitted values are unchanged', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: 'mountains',
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      descriptionMd: 'same description',
      bgImage: 'mountains',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
        changed: false,
      },
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('createProject accepts preset background ids', async () => {
    const result = await createProject({
      ownerId: OWNER_ID,
      name: 'Preq Station',
      bgImage: 'mountains',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
      },
    });
    expect(mocked.insertValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        bgImage: 'mountains',
      }),
    );
  });

  it('updateProject accepts Unsplash https URLs', async () => {
    const nextBgImage = 'https://images.unsplash.com/photo-123?w=1080&q=80';
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: 'mountains',
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      bgImage: nextBgImage,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
        changed: true,
      },
    });
    expect(mocked.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        bgImage: nextBgImage,
      }),
    );
    expect(vi.mocked(writeOutboxEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        eventType: PROJECT_UPDATED,
        entityType: 'project',
        entityId: 'PROJ',
      }),
    );
  });

  it('createProject rejects invalid background values before the database write', async () => {
    const result = await createProject({
      ownerId: OWNER_ID,
      name: 'Preq Station',
      bgImage: 'javascript:alert(1)',
    });

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Invalid background image.',
    });
    expect(mocked.db.transaction).not.toHaveBeenCalled();
  });

  it('updateProject rejects invalid background values before the database update', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: 'mountains',
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      bgImage: 'javascript:alert(1)',
    });

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Invalid background image.',
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('createProject persists background credit metadata for custom images', async () => {
    const result = await createProject({
      ownerId: OWNER_ID,
      name: 'Preq Station',
      bgImage: OPENVERSE_BG_IMAGE,
      bgImageCredit: OPENVERSE_BG_CREDIT,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
      },
    });
    expect(mocked.insertValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        bgImage: OPENVERSE_BG_IMAGE,
        bgImageCredit: OPENVERSE_BG_CREDIT,
      }),
    );
  });

  it('updateProject persists background credit metadata changes', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: OPENVERSE_BG_IMAGE,
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      bgImage: OPENVERSE_BG_IMAGE,
      bgImageCredit: OPENVERSE_BG_CREDIT,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
        changed: true,
      },
    });
    expect(mocked.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        bgImage: OPENVERSE_BG_IMAGE,
        bgImageCredit: OPENVERSE_BG_CREDIT,
      }),
    );
  });

  it('createProject rejects invalid background credit before the database write', async () => {
    const result = await createProject({
      ownerId: OWNER_ID,
      name: 'Preq Station',
      bgImage: OPENVERSE_BG_IMAGE,
      bgImageCredit: {
        provider: 'openverse',
        creatorName: '',
        creatorUrl: 'https://example.com/jane',
        sourceName: 'Flickr',
        sourceUrl: 'https://example.com/photo-1',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      },
    });

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Invalid background image credit.',
    });
    expect(mocked.db.transaction).not.toHaveBeenCalled();
  });

  it('updateProject persists normalized integration URLs', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: 'mountains',
      bgImageCredit: null,
      repoUrl: null,
      vercelUrl: null,
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      descriptionMd: 'same description',
      bgImage: 'mountains',
      repoUrl: 'https://github.com/example/repo',
      vercelUrl: 'https://example.vercel.app',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
        changed: true,
      },
    });
    expect(mocked.updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({
        repoUrl: 'https://github.com/example/repo',
        vercelUrl: 'https://example.vercel.app/',
      }),
    );
  });

  it('updateProject skips the database update when normalized integration URLs are unchanged', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      projectKey: 'PROJ',
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      description: 'same description',
      bgImage: 'mountains',
      bgImageCredit: null,
      repoUrl: 'https://github.com/example/repo',
      vercelUrl: 'https://example.vercel.app/',
    });

    const result = await updateProject({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      name: 'Preq Station',
      status: 'active',
      priority: 3,
      descriptionMd: 'same description',
      bgImage: 'mountains',
      repoUrl: 'https://github.com/example/repo',
      vercelUrl: 'https://example.vercel.app',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        projectKey: 'PROJ',
        changed: false,
      },
    });
    expect(mocked.db.update).not.toHaveBeenCalled();
  });
  it('updateProjectAgentInstructions returns not found for a missing project', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce(null);

    const result = await updateProjectAgentInstructions({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      instructions: 'Always answer in Korean.',
    });

    expect(result).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Project not found.',
    });
    expect(vi.mocked(setProjectSetting)).not.toHaveBeenCalled();
  });

  it('updateProjectAgentInstructions persists only the agent instructions setting', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce({
      id: PROJECT_ID,
      projectKey: 'PROJ',
    });

    const result = await updateProjectAgentInstructions({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      instructions: '  Always answer in Korean unless asked otherwise.  ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        instructions: 'Always answer in Korean unless asked otherwise.',
      },
    });
    expect(vi.mocked(setProjectSetting)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setProjectSetting)).toHaveBeenCalledWith(
      PROJECT_ID,
      'agent_instructions',
      'Always answer in Korean unless asked otherwise.',
      expect.anything(),
    );
    expect(vi.mocked(writeOutboxEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        eventType: PROJECT_UPDATED,
        entityType: 'project',
        entityId: 'PROJ',
      }),
    );
    expect(mocked.db.update).not.toHaveBeenCalled();
  });

  it('updateProjectDeploySettings emits a project updated outbox event', async () => {
    mocked.db.query.projects.findFirst.mockResolvedValueOnce({
      id: PROJECT_ID,
      projectKey: 'PROJ',
    });

    const result = await updateProjectDeploySettings({
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      strategy: 'feature_branch',
      defaultBranch: 'main',
      autoPr: 'false',
      commitOnReview: 'true',
      squashMerge: 'false',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: PROJECT_ID,
        settings: {
          strategy: 'feature_branch',
          default_branch: 'main',
          auto_pr: false,
          commit_on_review: true,
          squash_merge: false,
        },
      },
    });
    expect(vi.mocked(setProjectSetting)).toHaveBeenCalledTimes(5);
    expect(vi.mocked(writeOutboxEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        eventType: PROJECT_UPDATED,
        entityType: 'project',
        entityId: 'PROJ',
      }),
    );
  });
});
