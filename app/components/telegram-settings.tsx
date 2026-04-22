'use client';

import { Button, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useActionState, useState } from 'react';

import { SettingStatusMessage } from '@/app/components/setting-status-message';
import controlClasses from '@/app/components/settings-controls.module.css';
import { SubmitButton } from '@/app/components/submit-button';

type SaveActionState =
  | { ok: true; message: string }
  | { ok: false; field?: 'botToken' | 'chatId' | 'form'; message: string }
  | null;

type TelegramSettingsProps = {
  action: (prevState: unknown, formData: FormData) => Promise<SaveActionState>;
  defaultChatId: string;
  defaultEnabled: boolean;
  hasSavedBotToken: boolean;
};

type TestState =
  | { status: 'idle' }
  | { status: 'loading'; action: 'message' | 'status' }
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
  defaultChatId,
  defaultEnabled,
  hasSavedBotToken,
}: TelegramSettingsProps) {
  const [state, formAction] = useActionState(action, null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState(defaultChatId);
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const saveErrorField = state && !state.ok ? (state.field ?? 'form') : null;
  const botTokenError = saveErrorField === 'botToken';
  const chatIdError = saveErrorField === 'chatId';
  const fieldErrorMessage = state && !state.ok ? state.message : undefined;
  const saveStatus: { tone: 'success' | 'error'; message: string } | null = state
    ? { tone: state.ok ? 'success' : 'error', message: state.message }
    : null;
  const showSaveStatus = saveStatus && (saveStatus.tone === 'success' || saveErrorField === 'form');

  async function handleTestMessage(message?: string) {
    const trimmedBotToken = botToken.trim();
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
    setTestState({ status: 'loading', action });

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
        setTestState({
          status: 'success',
          message: message === '/status' ? 'Telegram /status sent.' : 'Test message sent.',
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
          <TextInput
            name="telegram_chat_id"
            label="Chat ID"
            placeholder="123456789"
            value={chatId}
            onChange={(event) => setChatId(event.currentTarget.value)}
            error={chatIdError ? fieldErrorMessage : undefined}
            className={`${controlClasses.fieldWide} ${controlClasses.touchInput}`}
          />
          <Checkbox
            name="telegram_enabled"
            value="true"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
            label="Enable Telegram messaging"
            size="lg"
            className={controlClasses.touchCheckbox}
          />
          <Group gap="sm" wrap="wrap" className={controlClasses.buttonGroup}>
            <Button
              type="button"
              variant="default"
              onClick={() => void handleTestMessage()}
              loading={testState.status === 'loading' && testState.action === 'message'}
              className={controlClasses.touchButton}
            >
              Send Test Message
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void handleTestMessage('/status')}
              loading={testState.status === 'loading' && testState.action === 'status'}
              className={controlClasses.touchButton}
            >
              Send /status Test
            </Button>
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
