import { type EngineKey, normalizeEngineKey } from '@/lib/engine-icons';

export type AgentModelOption = {
  label: string;
  value: string;
};

export type AgentModelCatalog = Record<EngineKey, AgentModelOption[]>;

export const DEFAULT_AGENT_MODEL_SELECT_VALUE = '__default__';

export const DEFAULT_AGENT_MODEL_CATALOG: AgentModelCatalog = {
  'claude-code': [
    { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  ],
  codex: [
    { label: 'GPT-5.5 Codex', value: 'gpt-5.5-codex' },
    { label: 'GPT-5.3 Codex', value: 'gpt-5.3-codex' },
    { label: 'GPT-5.3 Codex Mini', value: 'gpt-5.3-codex-mini' },
    { label: 'GPT-5.3 Codex Nano', value: 'gpt-5.3-codex-nano' },
  ],
  'gemini-cli': [
    { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
    { label: 'Gemini 3.1 Pro Preview', value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 3.1 Flash', value: 'gemini-3.1-flash' },
    { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  ],
};

const MODEL_ID_PATTERN = /^[a-zA-Z0-9._:/@+-]+$/;
const MAX_MODEL_ID_LENGTH = 120;

function normalizeModelText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function normalizeAgentModel(value: unknown) {
  const normalized = normalizeModelText(value);
  if (!normalized || normalized === DEFAULT_AGENT_MODEL_SELECT_VALUE) return null;
  if (normalized.toLowerCase() === 'default') return null;
  if (normalized.length > MAX_MODEL_ID_LENGTH) return null;
  if (!MODEL_ID_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeOption(value: unknown): AgentModelOption | null {
  if (typeof value === 'string') {
    const model = normalizeAgentModel(value);
    return model ? { label: model, value: model } : null;
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const model = normalizeAgentModel(record.value);
  if (!model) return null;

  return {
    label: normalizeModelText(record.label) || model,
    value: model,
  };
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: AgentModelOption[] = [];

  for (const item of value) {
    const option = normalizeOption(item);
    if (!option || seen.has(option.value)) continue;
    seen.add(option.value);
    options.push(option);
  }

  return options;
}

function normalizeCatalog(value: unknown, fallbackMissing: boolean): AgentModelCatalog {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    'claude-code':
      'claude-code' in source
        ? normalizeOptions(source['claude-code'])
        : fallbackMissing
          ? DEFAULT_AGENT_MODEL_CATALOG['claude-code']
          : [],
    codex:
      'codex' in source
        ? normalizeOptions(source.codex)
        : fallbackMissing
          ? DEFAULT_AGENT_MODEL_CATALOG.codex
          : [],
    'gemini-cli':
      'gemini-cli' in source
        ? normalizeOptions(source['gemini-cli'])
        : fallbackMissing
          ? DEFAULT_AGENT_MODEL_CATALOG['gemini-cli']
          : [],
  };
}

export function resolveAgentModelCatalog(value: string | null | undefined): AgentModelCatalog {
  if (!value?.trim()) return DEFAULT_AGENT_MODEL_CATALOG;

  try {
    return normalizeCatalog(JSON.parse(value), true);
  } catch {
    return DEFAULT_AGENT_MODEL_CATALOG;
  }
}

export function serializeAgentModelCatalog(catalog: AgentModelCatalog) {
  return JSON.stringify(normalizeCatalog(catalog, false));
}

export function parseAgentModelCatalogSetting(value: string) {
  if (!value.trim()) return { ok: true as const, value: '' };

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false as const, error: 'Agent model catalog must be a JSON object.' };
    }
    return {
      ok: true as const,
      value: serializeAgentModelCatalog(normalizeCatalog(parsed, false)),
    };
  } catch {
    return { ok: false as const, error: 'Agent model catalog must be valid JSON.' };
  }
}

export function getAgentModelSelectOptions(
  catalog: AgentModelCatalog,
  engine: string | null | undefined,
) {
  const engineKey = normalizeEngineKey(engine);
  const options = engineKey ? (catalog[engineKey] ?? []) : [];
  return [{ label: 'Default', value: DEFAULT_AGENT_MODEL_SELECT_VALUE }, ...options];
}

export function isAgentModelInCatalog(
  catalog: AgentModelCatalog,
  engine: string | null | undefined,
  model: string | null | undefined,
) {
  const normalized = normalizeAgentModel(model);
  if (!normalized) return true;
  const engineKey = normalizeEngineKey(engine);
  if (!engineKey) return false;
  return (catalog[engineKey] ?? []).some((option) => option.value === normalized);
}
