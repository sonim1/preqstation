import { SETTING_KEYS } from '@/lib/user-settings';

type TelegramDispatchSettings = Record<string, string>;

export type TelegramDispatchTarget = 'openclaw' | 'hermes';

const TARGET_SETTING_KEYS: Record<TelegramDispatchTarget, { chatId: string; enabled: string }> = {
  openclaw: {
    chatId: SETTING_KEYS.OPENCLAW_TELEGRAM_CHAT_ID,
    enabled: SETTING_KEYS.OPENCLAW_TELEGRAM_ENABLED,
  },
  hermes: {
    chatId: SETTING_KEYS.HERMES_TELEGRAM_CHAT_ID,
    enabled: SETTING_KEYS.HERMES_TELEGRAM_ENABLED,
  },
};

function resolveSettingValue(settings: TelegramDispatchSettings, key: string, fallbackKey: string) {
  const value = settings[key] ?? '';
  if (value !== '') {
    return value;
  }

  return settings[fallbackKey] ?? '';
}

export function resolveTelegramDispatchConfig(
  settings: TelegramDispatchSettings,
  target: TelegramDispatchTarget,
) {
  const targetKeys = TARGET_SETTING_KEYS[target];

  return {
    encryptedToken: settings[SETTING_KEYS.TELEGRAM_BOT_TOKEN] ?? '',
    chatId: resolveSettingValue(settings, targetKeys.chatId, SETTING_KEYS.TELEGRAM_CHAT_ID),
    enabled:
      resolveSettingValue(settings, targetKeys.enabled, SETTING_KEYS.TELEGRAM_ENABLED) === 'true',
  };
}

export function resolveTelegramDispatchAvailability(settings: TelegramDispatchSettings) {
  return {
    openclaw: resolveTelegramDispatchConfig(settings, 'openclaw').enabled,
    hermes: resolveTelegramDispatchConfig(settings, 'hermes').enabled,
  };
}
