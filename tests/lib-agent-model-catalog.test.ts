import { describe, expect, it } from 'vitest';

import {
  type AgentModelCatalog,
  DEFAULT_AGENT_MODEL_CATALOG,
  getAgentModelSelectOptions,
  isAgentModelInCatalog,
  normalizeAgentModel,
  parseAgentModelCatalogSetting,
  resolveAgentModelCatalog,
  serializeAgentModelCatalog,
} from '@/lib/agent-model-catalog';

describe('lib/agent-model-catalog', () => {
  it('resolves the built-in catalog when no saved setting exists', () => {
    const catalog = resolveAgentModelCatalog('');

    expect(catalog.codex.length).toBeGreaterThan(0);
    expect(catalog['claude-code'].length).toBeGreaterThan(0);
    expect(catalog['gemini-cli'].length).toBeGreaterThan(0);
  });

  it('uses the documented Codex models in order with labels matching values', () => {
    expect(DEFAULT_AGENT_MODEL_CATALOG.codex).toEqual([
      { label: 'gpt-5.5', value: 'gpt-5.5' },
      { label: 'gpt-5.4', value: 'gpt-5.4' },
      { label: 'gpt-5.4-mini', value: 'gpt-5.4-mini' },
      { label: 'gpt-5.3-codex', value: 'gpt-5.3-codex' },
      { label: 'gpt-5.3-codex-spark', value: 'gpt-5.3-codex-spark' },
      { label: 'gpt-5.2', value: 'gpt-5.2' },
    ]);
  });

  it('normalizes saved catalog options and drops unsupported engines', () => {
    const catalog = resolveAgentModelCatalog(
      JSON.stringify({
        codex: ['gpt-5-codex', { label: 'GPT-5', value: 'gpt-5' }, ''],
        'claude-code': [{ label: 'Sonnet', value: 'sonnet' }],
        unsupported: ['ignored'],
      }),
    );

    expect(catalog.codex).toEqual([
      { label: 'gpt-5-codex', value: 'gpt-5-codex' },
      { label: 'GPT-5', value: 'gpt-5' },
    ]);
    expect(catalog['claude-code']).toEqual([{ label: 'Sonnet', value: 'sonnet' }]);
    expect(catalog['gemini-cli']).toEqual(DEFAULT_AGENT_MODEL_CATALOG['gemini-cli']);
    expect('unsupported' in catalog).toBe(false);
  });

  it('includes a Codex default select option with the current default model label', () => {
    const options = getAgentModelSelectOptions(
      { ...DEFAULT_AGENT_MODEL_CATALOG, codex: [{ label: 'gpt-5.5', value: 'gpt-5.5' }] },
      'codex',
    );

    expect(options).toEqual([
      { label: 'Default (gpt-5.5)', value: '__default__' },
      { label: 'gpt-5.5', value: 'gpt-5.5' },
    ]);
    expect(normalizeAgentModel(options[0].value)).toBeNull();
  });

  it('keeps the generic default select option for non-Codex engines', () => {
    const options = getAgentModelSelectOptions(
      {
        ...DEFAULT_AGENT_MODEL_CATALOG,
        'claude-code': [{ label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' }],
      },
      'claude-code',
    );

    expect(options).toEqual([
      { label: 'Default', value: '__default__' },
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    ]);
  });

  it('falls back to an empty option list when a custom catalog is missing an engine', () => {
    const catalog = { codex: [{ label: 'GPT-5 Codex', value: 'gpt-5-codex' }] };

    expect(getAgentModelSelectOptions(catalog as AgentModelCatalog, 'gemini-cli')).toEqual([
      { label: 'Default', value: '__default__' },
    ]);
  });

  it('treats non-default models as out of catalog when a custom catalog is missing an engine', () => {
    const catalog = { codex: [{ label: 'GPT-5 Codex', value: 'gpt-5-codex' }] };

    expect(
      isAgentModelInCatalog(catalog as AgentModelCatalog, 'gemini-cli', 'gemini-2.5-pro'),
    ).toBe(false);
  });

  it('serializes catalog settings in a stable normalized shape', () => {
    expect(
      serializeAgentModelCatalog({
        codex: [{ label: 'GPT-5 Codex', value: 'gpt-5-codex' }],
        'claude-code': [],
        'gemini-cli': [{ label: 'Gemini Pro', value: 'gemini-2.5-pro' }],
      }),
    ).toBe(
      '{"claude-code":[],"codex":[{"label":"GPT-5 Codex","value":"gpt-5-codex"}],"gemini-cli":[{"label":"Gemini Pro","value":"gemini-2.5-pro"}]}',
    );
  });

  it('rejects invalid catalog setting JSON', () => {
    expect(parseAgentModelCatalogSetting('not-json')).toEqual({
      ok: false,
      error: 'Agent model catalog must be valid JSON.',
    });
  });

  it('accepts a blank catalog setting as a reset to defaults', () => {
    expect(parseAgentModelCatalogSetting('   ')).toEqual({
      ok: true,
      value: '',
    });
  });

  it('normalizes blank and default model values to null', () => {
    expect(normalizeAgentModel('')).toBeNull();
    expect(normalizeAgentModel('__default__')).toBeNull();
    expect(normalizeAgentModel(' gpt-5-codex ')).toBe('gpt-5-codex');
  });
});
