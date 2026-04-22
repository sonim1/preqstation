export type EngineConfig = {
  key: string;
  label: string;
  icon: string;
  color: string;
  iconColor: string;
  clawSuffix: string;
};

export const ENGINE_KEYS = ['claude-code', 'codex', 'gemini-cli'] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export const DEFAULT_ENGINE_KEY: EngineKey = 'claude-code';

export const ENGINE_CONFIGS: Record<EngineKey, EngineConfig> = {
  'claude-code': {
    key: 'claude-code',
    label: 'Claude Code',
    icon: '/icons/claude.svg',
    color: '#d97757',
    iconColor: '#d97757',
    clawSuffix: 'using Claude Code',
  },
  codex: {
    key: 'codex',
    label: 'Codex CLI',
    icon: '/icons/codex.svg',
    color: '#ffffff',
    iconColor: '#ffffff',
    clawSuffix: 'using Codex CLI',
  },
  'gemini-cli': {
    key: 'gemini-cli',
    label: 'Gemini CLI',
    icon: '/icons/gemini.svg',
    color: '#8ab4f8',
    iconColor: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #8ab4f8 100%)',
    clawSuffix: 'using Gemini CLI',
  },
};

export function normalizeEngineKey(engine: string | null | undefined): EngineKey | null {
  const normalized = engine?.trim().toLowerCase() || '';
  if (!normalized) return null;
  return ENGINE_KEYS.includes(normalized as EngineKey) ? (normalized as EngineKey) : null;
}

export function getEngineConfig(engine: string | null | undefined): EngineConfig | null {
  const normalized = normalizeEngineKey(engine);
  if (!normalized) return null;
  return ENGINE_CONFIGS[normalized] ?? null;
}
