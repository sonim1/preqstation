'use client';

import { Button, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useActionState, useEffect, useState } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { SubmitButton } from '@/app/components/submit-button';

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

  useEffect(() => {
    setOpenClawChatId(defaultOpenClawChatId);
    setOpenClawEnabled(defaultOpenClawEnabled);
    setHermesChatId(defaultHermesChatId);
    setHermesEnabled(defaultHermesEnabled);
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

  return (
    <Stack gap="sm">
      <form action={formAction}>
        <Stack gap="sm">
          <PasswordInput
            name="telegram_bot_token"
            label="Bot Token"
            placeholder="123456789:AA..."
            value={botToken}
            onChange={(event) => setBotToken(event.currentTarget.value)}
            error={botTokenError ? fieldErrorMessage : undefined}
            className={`${controlClasses.fieldWide} ${controlClasses.touchPasswordInput}`}
          />
          <Text size="xs" c="dimmed">
            {hasSavedBotToken
              ? 'Bot Token: Already set. Leave this blank to reuse it, or enter a new token to override it.'
              : 'Enter a Bot Token to test Telegram before saving.'}
          </Text>
          <Stack gap="xs">
            <Text fw={600}>OpenClaw Channel</Text>
            <Text size="xs" c="dimmed">
              Use this chat for OpenClaw task sends, `/status`, and QA dispatches.
            </Text>
            <TextInput
              name="telegram_openclaw_chat_id"
              label="OpenClaw Chat ID"
              placeholder="123456789"
              value={openClawChatId}
              onChange={(event) => setOpenClawChatId(event.currentTarget.value)}
              error={openClawChatIdError ? fieldErrorMessage : undefined}
              className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
            />
            <Checkbox
              name="telegram_openclaw_enabled"
              value="true"
              checked={openClawEnabled}
              onChange={(event) => setOpenClawEnabled(event.currentTarget.checked)}
              label="Enable OpenClaw Telegram messaging"
              size="lg"
              className={controlClasses.touchCheckbox}
            />
            <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
              <Button
                type="button"
                variant="default"
                onClick={() => void handleTestMessage('openclaw')}
                loading={
                  testState.status === 'loading' &&
                  testState.channel === 'openclaw' &&
                  testState.action === 'message'
                }
                className={controlClasses.touchButton}
              >
                Send OpenClaw Test
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => void handleTestMessage('openclaw', '/status')}
                loading={
                  testState.status === 'loading' &&
                  testState.channel === 'openclaw' &&
                  testState.action === 'status'
                }
                className={controlClasses.touchButton}
              >
                Send OpenClaw /status
              </Button>
            </Group>
          </Stack>
          <Stack gap="xs">
            <Text fw={600}>Hermes Channel</Text>
            <Text size="xs" c="dimmed">
              Use this chat for Hermes task sends from the dispatch target picker.
            </Text>
            <TextInput
              name="telegram_hermes_chat_id"
              label="Hermes Chat ID"
              placeholder="123456789"
              value={hermesChatId}
              onChange={(event) => setHermesChatId(event.currentTarget.value)}
              error={hermesChatIdError ? fieldErrorMessage : undefined}
              className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
            />
            <Checkbox
              name="telegram_hermes_enabled"
              value="true"
              checked={hermesEnabled}
              onChange={(event) => setHermesEnabled(event.currentTarget.checked)}
              label="Enable Hermes Telegram messaging"
              size="lg"
              className={controlClasses.touchCheckbox}
            />
            <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
              <Button
                type="button"
                variant="default"
                onClick={() => void handleTestMessage('hermes')}
                loading={
                  testState.status === 'loading' &&
                  testState.channel === 'hermes' &&
                  testState.action === 'message'
                }
                className={controlClasses.touchButton}
              >
                Send Hermes Test
              </Button>
            </Group>
          </Stack>
          <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
            <SubmitButton className={controlClasses.touchButton}>
              Save Telegram Settings
            </SubmitButton>
          </Group>
        </Stack>
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
