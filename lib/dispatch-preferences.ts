import { type EngineKey, normalizeEngineKey } from '@/lib/engine-icons';
import { TASK_DISPATCH_OBJECTIVES, type TaskDispatchObjective } from '@/lib/openclaw-command';
import type { BoardTaskStatus } from '@/lib/task-meta';

export const TASK_DISPATCH_PREFERENCES_STORAGE = 'pm:taskDispatchPreferences';
export const QA_DISPATCH_PREFERENCE_STORAGE = 'pm:qaDispatchPreference';

const TASK_DISPATCH_ACTIONS = ['send-telegram', 'send-hermes-telegram'] as const;

export type TaskDispatchPreferenceStatus = BoardTaskStatus;
export type TaskDispatchPreferenceAction = (typeof TASK_DISPATCH_ACTIONS)[number];
export type TaskDispatchPreference = {
  engine: EngineKey;
  action: TaskDispatchPreferenceAction;
  objective: TaskDispatchObjective;
};

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredValue(key: string): unknown {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: unknown) {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

function normalizeDispatchAction(value: unknown): TaskDispatchPreferenceAction | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) {
    return null;
  }

  return TASK_DISPATCH_ACTIONS.includes(normalized as TaskDispatchPreferenceAction)
    ? (normalized as TaskDispatchPreferenceAction)
    : null;
}

function normalizeTaskDispatchPreference(value: unknown): TaskDispatchPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const engine = normalizeEngineKey(record.engine as string | null | undefined);
  const action = normalizeDispatchAction(record.action);
  const objective =
    typeof record.objective === 'string' &&
    TASK_DISPATCH_OBJECTIVES.includes(record.objective as TaskDispatchObjective)
      ? (record.objective as TaskDispatchObjective)
      : 'default';
  if (!engine || !action) {
    return null;
  }

  return { engine, action, objective };
}

export function readTaskDispatchPreference(
  status: TaskDispatchPreferenceStatus,
): TaskDispatchPreference | null {
  const stored = readStoredValue(TASK_DISPATCH_PREFERENCES_STORAGE);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return null;
  }

  return normalizeTaskDispatchPreference((stored as Record<string, unknown>)[status]);
}

export function writeTaskDispatchPreference(
  status: TaskDispatchPreferenceStatus,
  value: TaskDispatchPreference,
) {
  const stored = readStoredValue(TASK_DISPATCH_PREFERENCES_STORAGE);
  const next =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...(stored as Record<string, unknown>) }
      : {};

  next[status] = value;
  writeStoredValue(TASK_DISPATCH_PREFERENCES_STORAGE, next);
}

export function readQaDispatchPreference(): EngineKey | null {
  return normalizeEngineKey(readStoredValue(QA_DISPATCH_PREFERENCE_STORAGE) as string | null);
}

export function writeQaDispatchPreference(engine: EngineKey) {
  writeStoredValue(QA_DISPATCH_PREFERENCE_STORAGE, engine);
}
