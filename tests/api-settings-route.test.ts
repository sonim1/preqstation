import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const clientInstance = { tag: 'client' };
  return {
    client: clientInstance,
    getOwnerUserOrNull: vi.fn(),
    assertSameOrigin: vi.fn(),
    getUserSettings: vi.fn(),
    setUserSetting: vi.fn(),
    writeOutboxEventStandalone: vi.fn(),
    withOwnerDb: vi.fn(
      async (_ownerId: string, callback: (client: typeof clientInstance) => unknown) =>
        callback(clientInstance),
    ),
    rebuildDashboardWorkLogRollups: vi.fn(),
  };
});

vi.mock('@/lib/owner', () => ({
  getOwnerUserOrNull: mocked.getOwnerUserOrNull,
}));

vi.mock('@/lib/request-security', () => ({
  assertSameOrigin: mocked.assertSameOrigin,
}));

vi.mock('@/lib/dashboard-rollups', () => ({
  rebuildDashboardWorkLogRollups: mocked.rebuildDashboardWorkLogRollups,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/outbox', () => ({
  ENTITY_SETTING: 'setting',
  SETTING_UPDATED: 'SETTING_UPDATED',
  writeOutboxEventStandalone: mocked.writeOutboxEventStandalone,
}));

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return {
    ...actual,
    getUserSettings: mocked.getUserSettings,
    setUserSetting: mocked.setUserSetting,
  };
});

import { PATCH } from '@/app/api/settings/route';

function patchRequest(body: unknown) {
  return new Request(`${TEST_BASE_URL}/api/settings`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: TEST_BASE_URL,
    },
    body: JSON.stringify(body),
  });
}

describe('app/api/settings/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOwnerUserOrNull.mockResolvedValue({ id: 'owner-1' });
    mocked.assertSameOrigin.mockResolvedValue(null);
    mocked.getUserSettings.mockResolvedValue({});
    mocked.setUserSetting.mockResolvedValue(undefined);
    mocked.writeOutboxEventStandalone.mockResolvedValue(undefined);
    mocked.rebuildDashboardWorkLogRollups.mockResolvedValue(undefined);
  });

  it('rejects removed engine preset keys', async () => {
    const response = await PATCH(patchRequest({ key: 'engine_default', value: 'claude-code' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid setting key' });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
    expect(mocked.writeOutboxEventStandalone).not.toHaveBeenCalled();
    expect(mocked.rebuildDashboardWorkLogRollups).not.toHaveBeenCalled();
  });

  it('rejects the dedicated QA engine key', async () => {
    const response = await PATCH(patchRequest({ key: 'engine_qa', value: 'gemini-cli' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid setting key' });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
  });

  it('rejects the removed sync interval key', async () => {
    const response = await PATCH(patchRequest({ key: 'sync_interval', value: '30000' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid setting key' });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
  });

  it('accepts the kitchen mode key', async () => {
    const response = await PATCH(patchRequest({ key: 'kitchen_mode', value: 'true' }));

    expect(response.status).toBe(200);
    expect(mocked.setUserSetting).toHaveBeenCalledWith(
      'owner-1',
      'kitchen_mode',
      'true',
      mocked.client,
    );
    expect(mocked.rebuildDashboardWorkLogRollups).not.toHaveBeenCalled();
  });

  it('accepts valid timezone values', async () => {
    const response = await PATCH(patchRequest({ key: 'timezone', value: 'America/Toronto' }));

    expect(response.status).toBe(200);
    expect(mocked.setUserSetting).toHaveBeenCalledWith(
      'owner-1',
      'timezone',
      'America/Toronto',
      mocked.client,
    );
    expect(mocked.rebuildDashboardWorkLogRollups).toHaveBeenCalledWith(
      'owner-1',
      'America/Toronto',
      mocked.client,
    );
  });

  it('accepts a normalized global agent model catalog', async () => {
    const normalizedCatalog =
      '{"claude-code":[{"label":"Sonnet","value":"sonnet"}],"codex":[{"label":"gpt-5-codex","value":"gpt-5-codex"}],"gemini-cli":[]}';
    const response = await PATCH(
      patchRequest({
        key: 'agent_model_catalog',
        value: JSON.stringify({
          codex: ['gpt-5-codex'],
          'claude-code': [{ label: 'Sonnet', value: 'sonnet' }],
          'gemini-cli': [],
          unsupported: ['ignored'],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, value: normalizedCatalog });
    expect(mocked.setUserSetting).toHaveBeenCalledWith(
      'owner-1',
      'agent_model_catalog',
      normalizedCatalog,
      mocked.client,
    );
  });

  it('rejects invalid agent model catalog JSON', async () => {
    const response = await PATCH(patchRequest({ key: 'agent_model_catalog', value: 'not-json' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Agent model catalog must be valid JSON.',
    });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
  });

  it('rejects invalid timezone values', async () => {
    const response = await PATCH(patchRequest({ key: 'timezone', value: 'Mars/Olympus' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid timezone' });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
    expect(mocked.rebuildDashboardWorkLogRollups).not.toHaveBeenCalled();
  });

  it('keeps rejecting unknown setting keys', async () => {
    const response = await PATCH(patchRequest({ key: 'engine_unknown', value: 'codex' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid setting key' });
    expect(mocked.setUserSetting).not.toHaveBeenCalled();
    expect(mocked.rebuildDashboardWorkLogRollups).not.toHaveBeenCalled();
  });
});
