// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    reactHooks.useActionState.mockReset();
    reactHooks.useActionState.mockReturnValue([null, vi.fn()]);
  });

  it('renders save controls, channel tabs, and test actions', () => {
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
    expect(html).toContain('role="tablist"');
    expect(html).toContain('OpenClaw Channel');
    expect(html).toContain('Hermes Channel');
    expect(html).toContain('Enabled');
    expect(html).toContain('Saved');
    expect(html).toContain('Send OpenClaw Test');
    expect(html).toContain('Send OpenClaw /status');
    expect(html).toContain('Send Hermes Test');
    expect(html).toContain('id="telegram-openclaw-panel"');
    expect(html).toMatch(/<section[^>]*id="telegram-hermes-panel"[^>]*hidden=""/);
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

  it('opens the Hermes tab first when Hermes is the only configured channel', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId=""
          defaultOpenClawEnabled={false}
          defaultHermesChatId="5678"
          defaultHermesEnabled
          hasSavedBotToken
        />
      </MantineProvider>,
    );

    expect(html).toMatch(/<section[^>]*id="telegram-openclaw-panel"[^>]*hidden=""/);
    expect(html).toContain('id="telegram-hermes-panel"');
    expect(html).toContain('Enable Hermes Telegram messaging');
    expect(html).toContain('Send Hermes Test');
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

  it('shows the channel panel that has a save error', () => {
    reactHooks.useActionState.mockReturnValue([
      {
        ok: false,
        message: 'Hermes Chat ID is required to enable Telegram.',
        field: 'hermesChatId',
      },
      vi.fn(),
    ]);

    const html = renderToStaticMarkup(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId="1234"
          defaultOpenClawEnabled
          defaultHermesChatId=""
          defaultHermesEnabled={false}
          hasSavedBotToken
        />
      </MantineProvider>,
    );

    expect(html).toMatch(/<section[^>]*id="telegram-openclaw-panel"[^>]*hidden=""/);
    expect(html).toMatch(/<section[^>]*id="telegram-hermes-panel"(?![^>]*hidden="")/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*name="telegram_hermes_chat_id"/);
    expect(html).toContain('Hermes Chat ID is required to enable Telegram.');
  });

  it('syncs chat ids, enable toggles, and the selected tab when server defaults change', async () => {
    const { container, rerender } = render(
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

    fireEvent.change(screen.getByLabelText('OpenClaw Chat ID'), {
      target: { value: 'draft-openclaw' },
    });
    fireEvent.click(screen.getByLabelText('Enable OpenClaw Telegram messaging'));
    fireEvent.click(screen.getByRole('tab', { name: /Hermes/ }));
    fireEvent.change(screen.getByLabelText('Hermes Chat ID'), {
      target: { value: 'draft-hermes' },
    });
    fireEvent.click(screen.getByLabelText('Enable Hermes Telegram messaging'));

    rerender(
      <MantineProvider>
        <TelegramSettings
          action={vi.fn(async () => null)}
          defaultOpenClawChatId="9999"
          defaultOpenClawEnabled={false}
          defaultHermesChatId="8888"
          defaultHermesEnabled
          hasSavedBotToken={false}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      const openClawInput = container.querySelector(
        'input[name="telegram_openclaw_chat_id"]',
      ) as HTMLInputElement | null;
      const hermesInput = container.querySelector(
        'input[name="telegram_hermes_chat_id"]',
      ) as HTMLInputElement | null;
      const openClawCheckbox = container.querySelector(
        'input[name="telegram_openclaw_enabled"]',
      ) as HTMLInputElement | null;
      const hermesCheckbox = container.querySelector(
        'input[name="telegram_hermes_enabled"]',
      ) as HTMLInputElement | null;
      const openClawPanel = container.querySelector('#telegram-openclaw-panel');
      const hermesPanel = container.querySelector('#telegram-hermes-panel');

      expect(openClawInput?.value).toBe('9999');
      expect(hermesInput?.value).toBe('8888');
      expect(openClawCheckbox?.checked).toBe(false);
      expect(hermesCheckbox?.checked).toBe(true);
      expect(screen.getByRole('tab', { name: /OpenClaw/ }).getAttribute('aria-selected')).toBe(
        'false',
      );
      expect(screen.getByRole('tab', { name: /Hermes/ }).getAttribute('aria-selected')).toBe(
        'true',
      );
      expect(openClawPanel?.hasAttribute('hidden')).toBe(true);
      expect(hermesPanel?.hasAttribute('hidden')).toBe(false);
    });
  });
});
