import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { projectSettings } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

export const PROJECT_SETTING_KEYS = {
  DEPLOY_STRATEGY: 'deploy_strategy',
  DEPLOY_DEFAULT_BRANCH: 'deploy_default_branch',
  DEPLOY_AUTO_PR: 'deploy_auto_pr',
  DEPLOY_COMMIT_ON_REVIEW: 'deploy_commit_on_review',
  DEPLOY_SQUASH_MERGE: 'deploy_squash_merge',
  AGENT_INSTRUCTIONS: 'agent_instructions',
} as const;

export const DEPLOY_STRATEGIES = ['direct_commit', 'feature_branch'] as const;
export type DeployStrategy = (typeof DEPLOY_STRATEGIES)[number];
const DEPLOY_STRATEGY_SET = new Set<string>(DEPLOY_STRATEGIES);

export const PROJECT_SETTING_DEFAULTS: Record<string, string> = {
  [PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]: 'direct_commit',
  [PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH]: 'main',
  [PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR]: 'false',
  [PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW]: 'true',
  [PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE]: 'true',
};

export type ProjectSettingEntry = {
  key: string;
  value: string;
};

export type DeployStrategyConfig = {
  strategy: DeployStrategy;
  default_branch: string;
  auto_pr: boolean;
  commit_on_review: boolean;
  squash_merge: boolean;
};

export function resolveAgentInstructions(
  settings: Record<string, string> | ProjectSettingEntry[] | null | undefined,
): string | null {
  const instructions = projectSettingsToRecord(settings)[PROJECT_SETTING_KEYS.AGENT_INSTRUCTIONS];
  return instructions ? instructions : null;
}

export function normalizeDeployStrategy(value: string | null | undefined): DeployStrategy {
  const normalized = (value || '').trim().toLowerCase();
  if (DEPLOY_STRATEGY_SET.has(normalized)) return normalized as DeployStrategy;
  return 'direct_commit';
}

function normalizeBooleanString(
  value: string | null | undefined,
  fallback: 'true' | 'false',
): 'true' | 'false' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'true') return 'true';
  if (normalized === 'false') return 'false';
  return fallback;
}

export function normalizeProjectSettingValue(key: string, value: string): string {
  const normalizedValue = (value || '').trim();
  if (key === PROJECT_SETTING_KEYS.DEPLOY_STRATEGY) {
    return normalizeDeployStrategy(normalizedValue);
  }
  if (key === PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH) {
    return normalizedValue || PROJECT_SETTING_DEFAULTS[PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH];
  }
  if (key === PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR) {
    return normalizeBooleanString(
      normalizedValue,
      PROJECT_SETTING_DEFAULTS[PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR] as 'true' | 'false',
    );
  }
  if (key === PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW) {
    return normalizeBooleanString(
      normalizedValue,
      PROJECT_SETTING_DEFAULTS[PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW] as 'true' | 'false',
    );
  }
  if (key === PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE) {
    return normalizeBooleanString(
      normalizedValue,
      PROJECT_SETTING_DEFAULTS[PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE] as 'true' | 'false',
    );
  }
  return normalizedValue;
}

export function normalizeProjectSettingsInput(
  settings: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings || {})) {
    const nextKey = (key || '').trim();
    if (!nextKey) continue;
    normalized[nextKey] = normalizeProjectSettingValue(nextKey, String(value ?? ''));
  }
  return normalized;
}

export function projectSettingsToRecord(
  settings: Record<string, string> | ProjectSettingEntry[] | null | undefined,
): Record<string, string> {
  const result: Record<string, string> = { ...PROJECT_SETTING_DEFAULTS };
  if (!settings) return result;

  if (Array.isArray(settings)) {
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
  } else {
    for (const [key, value] of Object.entries(settings)) {
      result[key] = value;
    }
  }

  return normalizeProjectSettingsInput(result);
}

export function resolveDeployStrategyConfig(
  settings: Record<string, string> | ProjectSettingEntry[] | null | undefined,
): DeployStrategyConfig {
  const merged = projectSettingsToRecord(settings);
  return {
    strategy: normalizeDeployStrategy(merged[PROJECT_SETTING_KEYS.DEPLOY_STRATEGY]),
    default_branch:
      merged[PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH] ||
      PROJECT_SETTING_DEFAULTS[PROJECT_SETTING_KEYS.DEPLOY_DEFAULT_BRANCH],
    auto_pr: merged[PROJECT_SETTING_KEYS.DEPLOY_AUTO_PR] === 'true',
    commit_on_review: merged[PROJECT_SETTING_KEYS.DEPLOY_COMMIT_ON_REVIEW] !== 'false',
    squash_merge: merged[PROJECT_SETTING_KEYS.DEPLOY_SQUASH_MERGE] !== 'false',
  };
}

export async function getProjectSetting(
  projectId: string,
  key: string,
  client: DbClientOrTx = db,
): Promise<string> {
  const setting = await client.query.projectSettings.findFirst({
    where: and(eq(projectSettings.projectId, projectId), eq(projectSettings.key, key)),
    columns: { value: true },
  });
  const fallback = PROJECT_SETTING_DEFAULTS[key] ?? '';
  return normalizeProjectSettingValue(key, setting?.value ?? fallback);
}

export async function getProjectSettings(
  projectId: string,
  client: DbClientOrTx = db,
): Promise<Record<string, string>> {
  const projectSettingsQuery = (
    client.query as
      | {
          projectSettings?: { findMany?: typeof db.query.projectSettings.findMany };
        }
      | undefined
  )?.projectSettings;
  if (!projectSettingsQuery?.findMany) return projectSettingsToRecord(null);

  try {
    const settings = await projectSettingsQuery.findMany({
      where: eq(projectSettings.projectId, projectId),
      columns: { key: true, value: true },
    });
    return projectSettingsToRecord(settings);
  } catch (error) {
    console.error('[project-settings] failed to load project settings, using defaults:', error);
    return projectSettingsToRecord(null);
  }
}

export async function setProjectSetting(
  projectId: string,
  key: string,
  value: string,
  client: DbClientOrTx = db,
): Promise<void> {
  await client
    .insert(projectSettings)
    .values({
      projectId,
      key,
      value: normalizeProjectSettingValue(key, value),
    })
    .onConflictDoUpdate({
      target: [projectSettings.projectId, projectSettings.key],
      set: { value: normalizeProjectSettingValue(key, value) },
    });
}
