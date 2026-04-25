import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import controlClasses from '@/app/components/settings-controls.module.css';
const reactHooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useActionState: reactHooks.useActionState,
  };
});

import {
  getTelegramTestValidationError,
  TelegramSettings,
} from '@/app/components/telegram-settings';

describe('app/components/telegram-settings', () => {
  beforeEach(() => {
    reactHooks.useActionState.mockReset();
    reactHooks.useActionState.mockReturnValue([null, vi.fn()]);
  });

  it('renders save controls and a dedicated /status test button', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId="1234"
          defaultOpenClawEnabled
          defaultHermesChatId="5678"
          defaultHermesEnabled={false}
          hasSavedBotToken={false}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Save Telegram Settings');
    expect(html).toContain('OpenClaw Channel');
    expect(html).toContain('Hermes Channel');
    expect(html).toContain('Send OpenClaw Test');
    expect(html).toContain('Send OpenClaw /status');
    expect(html).toContain('Send Hermes Test');
  });

  it('renders a single shared feedback slot when idle', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId="1234"
          defaultOpenClawEnabled
          defaultHermesChatId="5678"
          defaultHermesEnabled={false}
          hasSavedBotToken={false}
        />
      </MantineProvider>,
    );

    expect(html.split(controlClasses.statusSlot)).toHaveLength(2);
  });

  it('shows that a saved bot token is already set without exposing the token', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId="1234"
          defaultOpenClawEnabled
          defaultHermesChatId="5678"
          defaultHermesEnabled={false}
          hasSavedBotToken
        />
      </MantineProvider>,
    );

    expect(html).toContain('Already set');
    expect(html).toContain('reuse it');
  });

  it('allows blank test-token input when a saved token already exists', () => {
    expect(
      getTelegramTestValidationError({
        chatId: '1234',
        botToken: '',
        hasSavedBotToken: true,
      }),
    ).toBeNull();
  });

  it('still requires a token when nothing is saved', () => {
    expect(
      getTelegramTestValidationError({
        chatId: '1234',
        botToken: '',
        hasSavedBotToken: false,
      }),
    ).toBe('Please enter a Bot Token.');
  });

  it('associates chat-id save errors with the chat-id input', () => {
    reactHooks.useActionState.mockReturnValue([
      {
        ok: false,
        message: 'OpenClaw Chat ID is required to enable Telegram.',
        field: 'openClawChatId',
      },
      vi.fn(),
    ]);

    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId=""
          defaultOpenClawEnabled
          defaultHermesChatId="5678"
          defaultHermesEnabled={false}
          hasSavedBotToken
        />
      </MantineProvider>,
    );

    expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*name="telegram_openclaw_chat_id"/);
    expect(html).toContain('OpenClaw Chat ID is required to enable Telegram.');
  });
});
