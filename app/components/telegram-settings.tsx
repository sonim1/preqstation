'use client';

import {
  Badge,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useActionState, useEffect, useState } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { SubmitButton } from '@/app/components/submit-button';

import classes from './telegram-settings.module.css';

type SaveActionState =
  | { ok: true; message: string }
  | {
      ok: false;
      field?: 'botToken' | 'openClawChatId' | 'hermesChatId' | 'form';
      message: string;
    }
  | null;

type TelegramSettingsProps = {
  action: (prevState: unknown, formData: FormData) => Promise<SaveActionState>;
  defaultOpenClawChatId: string;
  defaultOpenClawEnabled: boolean;
  defaultHermesChatId: string;
  defaultHermesEnabled: boolean;
  hasSavedBotToken: boolean;
};

type TelegramChannel = 'openclaw' | 'hermes';

type TestState =
  | { status: 'idle' }
  | { status: 'loading'; channel: TelegramChannel; action: 'message' | 'status' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type ChannelStatus = {
  label: 'Enabled' | 'Saved' | 'Off';
  color: 'green' | 'gray';
};

type ChannelConfig = {
  key: TelegramChannel;
  title: string;
  summary: string;
  description: string;
  chatIdLabel: string;
  chatIdName: 'telegram_openclaw_chat_id' | 'telegram_hermes_chat_id';
  enableName: 'telegram_openclaw_enabled' | 'telegram_hermes_enabled';
  enableLabel: string;
  errorField: 'openClawChatId' | 'hermesChatId';
  testButtons: Array<{
    action: 'message' | 'status';
    label: string;
    message?: string;
  }>;
};

const CHANNEL_CONFIGS: readonly ChannelConfig[] = [
  {
    key: 'openclaw',
    title: 'OpenClaw',
    summary: 'Task sends, /status, and QA dispatches',
    description: 'Use this channel for OpenClaw task sends, /status, and QA dispatches.',
    chatIdLabel: 'OpenClaw Chat ID',
    chatIdName: 'telegram_openclaw_chat_id',
    enableName: 'telegram_openclaw_enabled',
    enableLabel: 'Enable OpenClaw Telegram messaging',
    errorField: 'openClawChatId',
    testButtons: [
      { action: 'message', label: 'Send OpenClaw Test' },
      { action: 'status', label: 'Send OpenClaw /status', message: '/status' },
    ],
  },
  {
    key: 'hermes',
    title: 'Hermes',
    summary: 'Hermes dispatch target messages',
    description: 'Use this channel for Hermes task sends from the dispatch target picker.',
    chatIdLabel: 'Hermes Chat ID',
    chatIdName: 'telegram_hermes_chat_id',
    enableName: 'telegram_hermes_enabled',
    enableLabel: 'Enable Hermes Telegram messaging',
    errorField: 'hermesChatId',
    testButtons: [{ action: 'message', label: 'Send Hermes Test' }],
  },
] as const;

export function getTelegramTestValidationError({
  chatId,
  botToken,
  hasSavedBotToken,
}: {
  chatId: string;
  botToken: string;
  hasSavedBotToken: boolean;
}) {
  if (!chatId.trim()) {
    return 'Please enter a Chat ID.';
  }
  if (!botToken.trim() && !hasSavedBotToken) {
    return 'Please enter a Bot Token.';
  }
  return null;
}

function resolveChannelStatus(enabled: boolean, chatId: string): ChannelStatus {
  if (enabled) {
    return { label: 'Enabled', color: 'green' };
  }
  if (chatId.trim()) {
    return { label: 'Saved', color: 'gray' };
  }
  return { label: 'Off', color: 'gray' };
}

function resolveInitialChannel({
  openClawEnabled,
  openClawChatId,
  hermesEnabled,
  hermesChatId,
}: {
  openClawEnabled: boolean;
  openClawChatId: string;
  hermesEnabled: boolean;
  hermesChatId: string;
}): TelegramChannel {
  if (openClawEnabled) return 'openclaw';
  if (hermesEnabled) return 'hermes';
  if (openClawChatId.trim()) return 'openclaw';
  if (hermesChatId.trim()) return 'hermes';
  return 'openclaw';
}

function shouldShowChannelDetails({
  enabled,
  chatId,
  hasError,
}: {
  enabled: boolean;
  chatId: string;
  hasError: boolean;
}) {
  return enabled || chatId.trim().length > 0 || hasError;
}

export function TelegramSettings({
  action,
  defaultOpenClawChatId,
  defaultOpenClawEnabled,
  defaultHermesChatId,
  defaultHermesEnabled,
  hasSavedBotToken,
}: TelegramSettingsProps) {
  const [state, formAction] = useActionState(action, null);
  const [botToken, setBotToken] = useState('');
  const [openClawChatId, setOpenClawChatId] = useState(defaultOpenClawChatId);
  const [openClawEnabled, setOpenClawEnabled] = useState(defaultOpenClawEnabled);
  const [hermesChatId, setHermesChatId] = useState(defaultHermesChatId);
  const [hermesEnabled, setHermesEnabled] = useState(defaultHermesEnabled);
  const [activeChannel, setActiveChannel] = useState<TelegramChannel>(() =>
    resolveInitialChannel({
      openClawEnabled: defaultOpenClawEnabled,
      openClawChatId: defaultOpenClawChatId,
      hermesEnabled: defaultHermesEnabled,
      hermesChatId: defaultHermesChatId,
    }),
  );
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const saveErrorField = state && !state.ok ? (state.field ?? 'form') : null;
  const botTokenError = saveErrorField === 'botToken';
  const openClawChatIdError = saveErrorField === 'openClawChatId';
  const hermesChatIdError = saveErrorField === 'hermesChatId';
  const fieldErrorMessage = state && !state.ok ? state.message : undefined;
  const saveStatus: { tone: 'success' | 'error'; message: string } | null = state
    ? { tone: state.ok ? 'success' : 'error', message: state.message }
    : null;
  const showSaveStatus = saveStatus && (saveStatus.tone === 'success' || saveErrorField === 'form');
  const activeErrorChannel =
    CHANNEL_CONFIGS.find((channel) => channel.errorField === saveErrorField)?.key ?? null;
  const visibleChannel = activeErrorChannel ?? activeChannel;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- local draft state also changes from user input and must resync when saved defaults change
    setOpenClawChatId(defaultOpenClawChatId);
    setOpenClawEnabled(defaultOpenClawEnabled);
    setHermesChatId(defaultHermesChatId);
    setHermesEnabled(defaultHermesEnabled);
    setActiveChannel(
      resolveInitialChannel({
        openClawEnabled: defaultOpenClawEnabled,
        openClawChatId: defaultOpenClawChatId,
        hermesEnabled: defaultHermesEnabled,
        hermesChatId: defaultHermesChatId,
      }),
    );
  }, [defaultHermesChatId, defaultHermesEnabled, defaultOpenClawChatId, defaultOpenClawEnabled]);

  async function handleTestMessage(channel: TelegramChannel, message?: string) {
    const trimmedBotToken = botToken.trim();
    const chatId = channel === 'openclaw' ? openClawChatId : hermesChatId;
    const validationError = getTelegramTestValidationError({
      chatId,
      botToken: trimmedBotToken,
      hasSavedBotToken,
    });
    if (validationError) {
      setTestState({ status: 'error', message: validationError });
      return;
    }

    const action = message === '/status' ? 'status' : 'message';
    setTestState({ status: 'loading', channel, action });

    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId.trim(),
          ...(trimmedBotToken ? { botToken: trimmedBotToken } : {}),
          ...(message ? { message } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (response.ok && body?.ok) {
        const channelLabel = channel === 'openclaw' ? 'OpenClaw' : 'Hermes';
        setTestState({
          status: 'success',
          message:
            message === '/status'
              ? `${channelLabel} /status sent.`
              : `${channelLabel} test message sent.`,
        });
        return;
      }

      setTestState({
        status: 'error',
        message: body?.error || 'Failed to send test message.',
      });
    } catch {
      setTestState({ status: 'error', message: 'Failed to request test message.' });
    }
  }

  const channelState = {
    openclaw: {
      chatId: openClawChatId,
      enabled: openClawEnabled,
      hasError: openClawChatIdError,
      onChatIdChange: setOpenClawChatId,
      onEnabledChange: setOpenClawEnabled,
    },
    hermes: {
      chatId: hermesChatId,
      enabled: hermesEnabled,
      hasError: hermesChatIdError,
      onChatIdChange: setHermesChatId,
      onEnabledChange: setHermesEnabled,
    },
  } as const;

  return (
    <Stack className={classes.root}>
      <form action={formAction} className={classes.form}>
        <div className={classes.tokenSection}>
          <PasswordInput
            name="telegram_bot_token"
            label="Bot Token"
            placeholder="123456789:AA..."
            value={botToken}
            onChange={(event) => setBotToken(event.currentTarget.value)}
            error={botTokenError ? fieldErrorMessage : undefined}
            className={`${controlClasses.fieldWide} ${controlClasses.touchPasswordInput}`}
          />
          <Text size="xs" c="dimmed" className={classes.tokenHelp}>
            {hasSavedBotToken
              ? 'Bot Token: Already set. Leave this blank to reuse it, or enter a new token to override it.'
              : 'Enter a Bot Token to test Telegram before saving.'}
          </Text>
        </div>

        <div className={classes.channelShell}>
          <div className={classes.channelTabs} role="tablist" aria-label="Telegram channels">
            {CHANNEL_CONFIGS.map((channel) => {
              const channelStateForTab = channelState[channel.key];
              const status = resolveChannelStatus(
                channelStateForTab.enabled,
                channelStateForTab.chatId,
              );
              const selected = visibleChannel === channel.key;

              return (
                <UnstyledButton
                  key={channel.key}
                  id={`telegram-${channel.key}-tab`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`telegram-${channel.key}-panel`}
                  className={classes.channelTab}
                  data-active={selected ? 'true' : 'false'}
                  onClick={() => setActiveChannel(channel.key)}
                >
                  <div className={classes.channelTabRow}>
                    <Text fw={700} className={classes.channelTabTitle}>
                      {channel.title}
                    </Text>
                    <Badge color={status.color} variant={selected ? 'filled' : 'light'} size="sm">
                      {status.label}
                    </Badge>
                  </div>
                  <Text size="sm" className={classes.channelTabMeta}>
                    {channel.summary}
                  </Text>
                </UnstyledButton>
              );
            })}
          </div>

          {CHANNEL_CONFIGS.map((channel) => {
            const channelStateForPanel = channelState[channel.key];
            const showDetails = shouldShowChannelDetails({
              enabled: channelStateForPanel.enabled,
              chatId: channelStateForPanel.chatId,
              hasError: channelStateForPanel.hasError,
            });

            return (
              <section
                key={channel.key}
                id={`telegram-${channel.key}-panel`}
                role="tabpanel"
                aria-labelledby={`telegram-${channel.key}-tab`}
                hidden={visibleChannel !== channel.key}
                className={classes.channelPanel}
              >
                <div className={classes.channelPanelHeader}>
                  <div className={classes.channelPanelCopy}>
                    <Text fw={700} className={classes.channelPanelTitle}>
                      {channel.title} Channel
                    </Text>
                    <Text size="sm" c="dimmed">
                      {channel.description}
                    </Text>
                  </div>
                  <Checkbox
                    name={channel.enableName}
                    value="true"
                    checked={channelStateForPanel.enabled}
                    onChange={(event) =>
                      channelStateForPanel.onEnabledChange(event.currentTarget.checked)
                    }
                    label={channel.enableLabel}
                    size="lg"
                    className={controlClasses.touchCheckbox}
                  />
                </div>

                {showDetails ? (
                  <div className={classes.channelDetails}>
                    <TextInput
                      name={channel.chatIdName}
                      label={channel.chatIdLabel}
                      placeholder="123456789"
                      value={channelStateForPanel.chatId}
                      onChange={(event) =>
                        channelStateForPanel.onChatIdChange(event.currentTarget.value)
                      }
                      error={channelStateForPanel.hasError ? fieldErrorMessage : undefined}
                      className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
                    />
                    <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
                      {channel.testButtons.map((button) => (
                        <Button
                          key={button.label}
                          type="button"
                          variant="default"
                          onClick={() => void handleTestMessage(channel.key, button.message)}
                          loading={
                            testState.status === 'loading' &&
                            testState.channel === channel.key &&
                            testState.action === button.action
                          }
                          className={controlClasses.touchButton}
                        >
                          {button.label}
                        </Button>
                      ))}
                    </Group>
                  </div>
                ) : (
                  <>
                    <input
                      type="hidden"
                      name={channel.chatIdName}
                      value={channelStateForPanel.chatId}
                    />
                    <div className={classes.channelHint}>
                      <Text size="sm" c="dimmed">
                        Enable this channel to add a chat ID and send a test message.
                      </Text>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>

        <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
          <SubmitButton className={controlClasses.touchButton}>Save Telegram Settings</SubmitButton>
        </Group>
      </form>

      <div className={controlClasses.statusSlot}>
        {showSaveStatus ? (
          <SettingStatusMessage tone={saveStatus.tone} message={saveStatus.message} />
        ) : null}
        {testState.status === 'success' ? (
          <SettingStatusMessage tone="success" message={testState.message} />
        ) : null}
        {testState.status === 'error' ? (
          <SettingStatusMessage tone="error" message={testState.message} />
        ) : null}
      </div>
    </Stack>
  );
}
