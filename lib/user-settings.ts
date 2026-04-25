import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import type { DbClientOrTx } from '@/lib/db/types';

export const SETTING_KEYS = {
  KITCHEN_MODE: 'kitchen_mode',
  TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
  TELEGRAM_CHAT_ID: 'telegram_chat_id',
  TELEGRAM_ENABLED: 'telegram_enabled',
  OPENCLAW_TELEGRAM_CHAT_ID: 'openclaw_telegram_chat_id',
  OPENCLAW_TELEGRAM_ENABLED: 'openclaw_telegram_enabled',
  HERMES_TELEGRAM_CHAT_ID: 'hermes_telegram_chat_id',
  HERMES_TELEGRAM_ENABLED: 'hermes_telegram_enabled',
  TIMEZONE: 'timezone',
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.KITCHEN_MODE]: 'false',
  [SETTING_KEYS.TELEGRAM_BOT_TOKEN]: '',
  [SETTING_KEYS.TELEGRAM_CHAT_ID]: '',
  [SETTING_KEYS.TELEGRAM_ENABLED]: 'false',
  [SETTING_KEYS.OPENCLAW_TELEGRAM_CHAT_ID]: '',
  [SETTING_KEYS.OPENCLAW_TELEGRAM_ENABLED]: '',
  [SETTING_KEYS.HERMES_TELEGRAM_CHAT_ID]: '',
  [SETTING_KEYS.HERMES_TELEGRAM_ENABLED]: '',
  [SETTING_KEYS.TIMEZONE]: '',
};

export async function getUserSetting(
  ownerId: string,
  key: string,
  client: DbClientOrTx = db,
): Promise<string> {
  const setting = await client.query.userSettings.findFirst({
    where: and(eq(userSettings.ownerId, ownerId), eq(userSettings.key, key)),
    columns: { value: true },
  });
  if (setting) return setting.value;

  return SETTING_DEFAULTS[key] ?? '';
}

export async function getUserSettings(
  ownerId: string,
  client: DbClientOrTx = db,
): Promise<Record<string, string>> {
  const settings = await client.query.userSettings.findMany({
    where: eq(userSettings.ownerId, ownerId),
    columns: { key: true, value: true },
  });
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const s of settings) {
    if (s.key in result) {
      result[s.key] = s.value;
    }
  }
  return result;
}

export async function setUserSetting(
  ownerId: string,
  key: string,
  value: string,
  client: DbClientOrTx = db,
): Promise<void> {
  await client
    .insert(userSettings)
    .values({ ownerId, key, value })
    .onConflictDoUpdate({
      target: [userSettings.ownerId, userSettings.key],
      set: { value },
    });
}
