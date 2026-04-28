import { describe, expect, it } from 'vitest';

import {
  normalizeProjectSettingsInput,
  PROJECT_SETTING_DEFAULTS,
  PROJECT_SETTING_KEYS,
  projectSettingsToRecord,
  resolveAgentInstructions,
  resolveDeployStrategyConfig,
} from '@/lib/project-settings';

describe('lib/project-settings', () => {
  it('resolves deploy strategy defaults when no settings exist', () => {
    const result = resolveDeployStrategyConfig(null);
    expect(result).toEqual({
      strategy: 'direct_commit',
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: true,
    });
  });

  it('coerces legacy none deploy strategy values to direct commit', () => {
    const result = resolveDeployStrategyConfig({
      [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: 'none',
    });

    expect(result).toEqual({
      strategy: 'direct_commit',
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: true,
    });
  });

  it('normalizes strategy and boolean values', () => {
    const normalized = normalizeProjectSettingsInput({
      [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: 'FEATURE_BRANCH',
      [PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH]: ' release ',
      [PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR]: 'TRUE',
      [PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW]: 'false',
    });

    expect(normalized).toEqual({
      [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: 'feature_branch',
      [PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH]: 'release',
      [PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR]: 'true',
      [PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW]: 'false',
    });
  });

  it('builds merged project settings record from db rows + defaults', () => {
    const merged = projectSettingsToRecord([
      {
        key: PROJECT_SETTING_KEYS.DEPLOY_STRATEGY,
        value: 'direct_commit',
      },
    ]);

    expect(merged).toEqual({
      ...PROJECT_SETTING_DEFAULTS,
      [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: 'direct_commit',
    });
  });

  it('trims agent instruction values in normalized input', () => {
    const normalized = normalizeProjectSettingsInput({
      [PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS]:
        '  Always answer in Korean unless asked otherwise.  ',
    });

    expect(normalized).toEqual({
      [PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS]: 'Always answer in Korean unless asked otherwise.',
    });
  });

  it('resolves blank agent instructions to null', () => {
    expect(resolveAgentInstructions(null)).toBeNull();
    expect(
      resolveAgentInstructions({
        [PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS]: '   ',
      }),
    ).toBeNull();
    expect(
      resolveAgentInstructions({
        [PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS]:
          '  Always answer in Korean unless asked otherwise.  ',
      }),
    ).toBe('Always answer in Korean unless asked otherwise.');
  });
});
