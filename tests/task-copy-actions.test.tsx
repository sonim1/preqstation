// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tabler/icons-react', () => {
  const icon = (name: string) => {
    const MockIcon = () => <svg data-icon={name} />;
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };

  return {
    IconCheck: icon('check'),
    IconCopy: icon('copy'),
    IconInfoCircle: icon('info-circle'),
    IconLoader2: icon('loader'),
    IconSend: icon('send'),
    IconX: icon('x'),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: ({
    className,
    src,
    ...props
  }: {
    className?: string;
    src: string;
    [key: string]: unknown;
  }) => <span className={className} data-next-image={src} {...props} />,
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { MantineProvider } from '@mantine/core';

import { TaskCopyActions } from '@/app/components/task-copy-actions';
import { TASK_DISPATCH_PREFERENCES_STORAGE } from '@/lib/dispatch-preferences';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const originalWindow = globalThis.window;
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  originalWindow,
  'localStorage',
);
const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(originalWindow, 'matchMedia');
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  originalWindow.navigator,
  'clipboard',
);
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  originalWindow.navigator,
  'platform',
);
const legacyClaudeDispatchAction = ['send', 'claude-code'].join('-');

function setNavigatorPlatform(platform: string) {
  Object.defineProperty(originalWindow.navigator, 'platform', {
    configurable: true,
    value: platform,
  });
}

function renderTaskCopyActions(props: Partial<React.ComponentProps<typeof TaskCopyActions>> = {}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <TaskCopyActions
        taskKey="PROJ-224"
        branchName="task/proj-224/move-status-test-button"
        status="todo"
        engine="codex"
        telegramEnabled
        {...props}
      />
    </MantineProvider>,
  );
}

function renderTaskCopyActionsClient(
  props: Partial<React.ComponentProps<typeof TaskCopyActions>> = {},
) {
  return render(
    <MantineProvider>
      <TaskCopyActions
        taskKey="PROJ-224"
        branchName="task/proj-224/move-status-test-button"
        status="todo"
        engine="codex"
        telegramEnabled
        {...props}
      />
    </MantineProvider>,
  );
}

function createPendingTelegramSend() {
  const pendingSend = createTelegramSendResponse();
  const fetchMock = vi.fn<typeof fetch>(() => pendingSend.response);
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, resolveResponse: pendingSend.resolveOk };
}

function createTelegramSendResponse() {
  let resolveResponse: (() => void) | null = null;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = () => {
      resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    };
  });
  return { response, resolveOk: () => resolveResponse?.() };
}

async function resolveTelegramSend(send: ReturnType<typeof createTelegramSendResponse>) {
  await act(async () => {
    send.resolveOk();
    await send.response;
    await Promise.resolve();
  });
}

describe('app/components/task-copy-actions', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    setNavigatorPlatform('MacIntel');
    localStorage = new MemoryStorage();
    Object.defineProperty(originalWindow, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(originalWindow, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalLocalStorageDescriptor) {
      Object.defineProperty(originalWindow, 'localStorage', originalLocalStorageDescriptor);
    }
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(originalWindow, 'matchMedia', originalMatchMediaDescriptor);
    } else {
      Reflect.deleteProperty(originalWindow, 'matchMedia');
    }
    if (originalClipboardDescriptor) {
      Object.defineProperty(originalWindow.navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(originalWindow.navigator, 'clipboard');
    }
    if (originalPlatformDescriptor) {
      Object.defineProperty(originalWindow.navigator, 'platform', originalPlatformDescriptor);
    } else {
      Reflect.deleteProperty(originalWindow.navigator, 'platform');
    }
  });

  it('renders a flat dispatch review flow with a static prompt preview', () => {
    const html = renderTaskCopyActions({ engine: 'codex' });

    expect(html).toContain('Dispatch');
    expect(html).toContain('task-dispatch-engine-segments');
    expect(html).toContain('task-dispatch-target-segments');
    expect(html).toContain('task-dispatch-mode-segments');
    expect(html).toMatch(
      /task-dispatch-target-segments"[^>]*data-option-count="2"[^>]*data-selected-index="0"/,
    );
    expect(html).toMatch(
      /task-dispatch-engine-segments"[^>]*data-option-count="3"[^>]*data-selected-index="1"/,
    );
    expect(html).toMatch(
      /task-dispatch-mode-segments"[^>]*data-option-count="2"[^>]*data-selected-index="0"/,
    );
    expect(html).toContain('Claude');
    expect(html).toContain('Codex');
    expect(html).toContain('Gemini');
    expect(html).toContain('data-engine-icon="claude-code"');
    expect(html).toContain('--engine-color:#d97757');
    expect(html).toContain('data-engine-icon="codex"');
    expect(html).toContain('--engine-color:#ffffff');
    expect(html).toContain('data-engine-icon="gemini-cli"');
    expect(html).toContain(
      '--engine-color:linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #8ab4f8 100%)',
    );
    expect(html).toContain('Implement');
    expect(html).toContain('Ask');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('Plan');
    expect(html).not.toContain('QA');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Dispatch prompt"');
    expect(html).toContain('task-dispatch-prompt-shell');
    expect(html).not.toContain('task-dispatch-preview');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-collapsible="true"');
    expect(html).not.toContain('role="textbox"');
    expect(html).not.toContain('aria-readonly="true"');
    expect(html).toContain('data-task-dispatch-prompt');
    expect(html).not.toContain('<textarea');
    expect(html).toContain('aria-label="Copy dispatch prompt"');
    expect(html).toContain('aria-label="Send dispatch"');
    expect(html.indexOf('task-dispatch-mode-segments')).toBeLessThan(
      html.indexOf('data-task-dispatch-prompt'),
    );
    expect(html.indexOf('data-task-dispatch-prompt')).toBeLessThan(
      html.indexOf('aria-label="Send dispatch"'),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('🦞 Telegram');
    expect(html).toContain('H Telegram');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).not.toContain('Channels');
    expect(html).not.toContain('aria-label="Select target: Channels"');
    expect(html).toContain(
      '!/skill preqstation-dispatch implement PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );

    expect(html).not.toContain('data-menu');
    expect(html).not.toContain('openclaw-action-trigger');
    expect(html).not.toContain('Send to Telegram');
    expect(html).not.toContain('Copy Telegram');
    expect(html).not.toContain('Selected action:');
  });

  it('renders the bottom dispatch bar with dropdown controls and prompt preview', () => {
    const html = renderTaskCopyActions({
      placement: 'bottom',
      dispatchTarget: 'hermes-telegram',
    });

    expect(html).toContain('task-dispatch-bottom-bar');
    expect(html).toContain('data-placement="bottom"');
    expect(html).toContain('aria-label="Engine"');
    expect(html).toContain('aria-label="Target"');
    expect(html).toContain('aria-label="Mode"');
    expect(html).toContain('aria-label="Message"');
    expect(html).toContain('Prompt');
    expect(html).toContain('data-task-dispatch-prompt');
    expect(html).not.toContain('aria-label="Send dispatch"');
    expect(html).not.toContain('task-dispatch-engine-segments');
    expect(html).not.toContain('task-dispatch-target-segments');
    expect(html).not.toContain('task-dispatch-mode-segments');
  });

  it('renders the bottom dispatch label without adding a heading', () => {
    const html = renderTaskCopyActions({ placement: 'bottom' });

    expect(html).toContain('task-dispatch-bottom-title');
    expect(html).not.toContain('<h2');
  });

  it('uses the bottom message as ask_hint only when Ask is selected', async () => {
    const pendingSend = createTelegramSendResponse();
    const fetchMock = vi.fn<typeof fetch>(() => pendingSend.response);
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'codex',
          action: 'send-telegram',
          objective: 'ask',
        },
      }),
    );

    renderTaskCopyActionsClient({
      placement: 'bottom',
      noteMarkdown: '## Context\n\n---\n\nAsk:\nUse note ask hint',
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Use bottom message' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(options?.body))).toEqual({
      taskKey: 'PROJ-224',
      message:
        '!/skill preqstation-dispatch ask PROJ-224 using codex branch_name="task/proj-224/move-status-test-button" ask_hint="Use bottom message"',
    });
    expect(String(options?.body)).not.toContain('Use note ask hint');
  });

  it('enables the bottom message only while Ask is selected', () => {
    renderTaskCopyActionsClient({ placement: 'bottom' });

    const messageInput = screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement;
    const modeSelect = screen.getByRole('combobox', { name: 'Mode' });

    expect(messageInput.matches(':disabled')).toBe(true);

    fireEvent.change(modeSelect, { target: { value: 'ask' } });

    expect(messageInput.matches(':disabled')).toBe(false);
  });

  it('clears the bottom message when the task key changes', async () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'codex',
          action: 'send-telegram',
          objective: 'ask',
        },
      }),
    );

    const view = render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
          placement="bottom"
        />
      </MantineProvider>,
    );

    const messageInput = screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement;

    fireEvent.change(messageInput, {
      target: { value: 'Use bottom message' },
    });

    expect(messageInput.value).toBe('Use bottom message');

    await act(async () => {
      view.rerender(
        <MantineProvider>
          <TaskCopyActions
            taskKey="PROJ-225"
            branchName="task/proj-225/move-status-test-button"
            status="todo"
            engine="codex"
            telegramEnabled
            placement="bottom"
          />
        </MantineProvider>,
      );
    });

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement).value).toBe(
        '',
      );
    });
  });

  it('omits the platform-dependent send shortcut during static render', () => {
    const html = renderTaskCopyActions({ engine: 'codex' });

    expect(html).not.toContain('Cmd+Enter');
    expect(html).not.toContain('Ctrl+Enter');
    expect(html).not.toContain('task-dispatch-send-shortcut');
  });

  it('uses Cmd+Enter for the send shortcut label after mounting on Apple platforms', async () => {
    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    expect(await screen.findByText('Cmd+Enter')).toBeTruthy();
    expect(screen.queryByText('Ctrl+Enter')).toBeNull();
  });

  it('uses Ctrl+Enter for the send shortcut label after mounting on non-Apple platforms', async () => {
    setNavigatorPlatform('Win32');

    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    expect(await screen.findByText('Ctrl+Enter')).toBeTruthy();
    expect(screen.queryByText('Cmd+Enter')).toBeNull();
  });

  it('persists the current dispatch preference when copying the prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy dispatch prompt' }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(
      JSON.parse(window.localStorage.getItem(TASK_DISPATCH_PREFERENCES_STORAGE) ?? '{}'),
    ).toEqual({
      todo: {
        engine: 'codex',
        action: 'send-telegram',
        objective: 'implement',
      },
    });
  });

  it('does not send duplicate dispatches when Mod+Enter repeats while a send is running', async () => {
    const { fetchMock, resolveResponse } = createPendingTelegramSend();
    const onTaskQueued = vi.fn();

    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
          onTaskQueued={onTaskQueued}
        />
      </MantineProvider>,
    );

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/telegram/send');
    expect(JSON.parse(String(options?.body))).toEqual({
      taskKey: 'PROJ-224',
      message:
        '!/skill preqstation-dispatch implement PROJ-224 using codex branch_name="task/proj-224/move-status-test-button"',
    });

    resolveResponse();
    await waitFor(() => expect(onTaskQueued).toHaveBeenCalledTimes(1));
  });

  it('suppresses the Mod+Enter dispatch shortcut when another composer owns it', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const suppressedShortcutProps = { suppressShortcut: true } as unknown as Partial<
      React.ComponentProps<typeof TaskCopyActions>
    >;

    const html = renderTaskCopyActions(suppressedShortcutProps);
    expect(html).toContain('aria-label="Send dispatch"');
    expect(html).not.toContain('Cmd+Enter');

    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
          {...suppressedShortcutProps}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Send dispatch' }).textContent).not.toContain(
      'Cmd+Enter',
    );

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a later dispatch loading when an earlier reset timer expires', async () => {
    vi.useFakeTimers();
    const firstSend = createTelegramSendResponse();
    const secondSend = createTelegramSendResponse();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstSend.response)
      .mockReturnValueOnce(secondSend.response);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    const sendButton = screen.getByRole('button', { name: 'Send dispatch' });

    fireEvent.click(sendButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendButton.textContent).toContain('Sending');

    await resolveTelegramSend(firstSend);
    expect(sendButton.textContent).toContain('Sent');

    fireEvent.click(sendButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sendButton.textContent).toContain('Sending');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(sendButton.textContent).toContain('Sending');
    expect(sendButton.matches(':disabled')).toBe(true);

    await resolveTelegramSend(secondSend);
    expect(sendButton.textContent).toContain('Sent');
  });

  it('resets dispatch state and pending reset timer when the task key changes', async () => {
    vi.useFakeTimers();
    const firstSend = createTelegramSendResponse();
    const secondSend = createTelegramSendResponse();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstSend.response)
      .mockReturnValueOnce(secondSend.response);
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send dispatch' }));
    await resolveTelegramSend(firstSend);
    expect(screen.getByRole('button', { name: 'Send dispatch' }).textContent).toContain('Sent');

    await act(async () => {
      view.rerender(
        <MantineProvider>
          <TaskCopyActions
            taskKey="PROJ-225"
            branchName="task/proj-225/move-status-test-button"
            status="todo"
            engine="codex"
            telegramEnabled
          />
        </MantineProvider>,
      );
    });

    const sendButton = screen.getByRole('button', { name: 'Send dispatch' });
    expect(sendButton.textContent).toContain('Send');

    fireEvent.click(sendButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe('/api/telegram/send');
    expect(JSON.parse(String(options?.body)).taskKey).toBe('PROJ-225');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(sendButton.textContent).toContain('Sending');
    expect(sendButton.matches(':disabled')).toBe(true);
  });

  it('keeps the next task guarded when the previous task resolves during its send', async () => {
    vi.useFakeTimers();
    const firstSend = createTelegramSendResponse();
    const secondSend = createTelegramSendResponse();
    const duplicateSend = createTelegramSendResponse();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstSend.response)
      .mockReturnValueOnce(secondSend.response)
      .mockReturnValueOnce(duplicateSend.response);
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-224"
          branchName="task/proj-224/move-status-test-button"
          status="todo"
          engine="codex"
          telegramEnabled
        />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send dispatch' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(
        <MantineProvider>
          <TaskCopyActions
            taskKey="PROJ-225"
            branchName="task/proj-225/move-status-test-button"
            status="todo"
            engine="codex"
            telegramEnabled
          />
        </MantineProvider>,
      );
    });

    const sendButton = screen.getByRole('button', { name: 'Send dispatch' });
    expect(sendButton.textContent).toContain('Send');

    fireEvent.click(sendButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, options] = fetchMock.mock.calls[1] ?? [];
    expect(JSON.parse(String(options?.body)).taskKey).toBe('PROJ-225');
    expect(sendButton.textContent).toContain('Sending');

    await resolveTelegramSend(firstSend);
    expect(sendButton.textContent).toContain('Sending');
    expect(sendButton.matches(':disabled')).toBe(true);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(sendButton.textContent).toContain('Sending');

    await resolveTelegramSend(secondSend);
  });

  it('falls back to the status mode when stored mode is not available for the column', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'gemini-cli',
          action: 'send-telegram',
          objective: 'review',
        },
      }),
    );

    const html = renderTaskCopyActions({ engine: 'codex' });

    expect(html).toContain('aria-label="Selected engine: Gemini"');
    expect(html).toContain('aria-label="Selected mode: Implement"');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).not.toContain('aria-label="Select mode: Review"');
    expect(html).toContain(
      '!/skill preqstation-dispatch implement PROJ-224 using gemini-cli branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('shows only Telegram targets for Claude task-edit dispatch', () => {
    const html = renderTaskCopyActions({ engine: 'claude-code' });

    expect(html).toContain('🦞 Telegram');
    expect(html).toContain('H Telegram');
    expect(html).toMatch(
      /task-dispatch-target-segments"[^>]*data-option-count="2"[^>]*data-selected-index="0"/,
    );
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).toContain('aria-label="Select target: H Telegram"');
    expect(html).toContain('data-engine-icon="claude-code"');
    expect(html).not.toContain('Channels');
  });

  it('shows the Hermes Telegram dispatch payload when H Telegram is selected', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'codex',
          action: 'send-hermes-telegram',
          objective: 'implement',
        },
      }),
    );

    const html = renderTaskCopyActions({ engine: 'codex' });

    expect(html).toContain('aria-label="Selected target: H Telegram"');
    expect(html).toContain('Telegram');
    expect(html).toContain('class="task-dispatch-target-logo"');
    expect(html).toContain('data-next-image="/icons/hermes-agent.png"');
    expect(html).not.toContain('>H<');
    expect(html).toContain('/preqstation_dispatch@PreqHermesBot');
    expect(html).toContain('project_key=PROJ');
    expect(html).toContain('task_key=PROJ-224');
    expect(html).toContain('objective=implement');
    expect(html).toContain('engine=codex');
    expect(html).toContain('branch_name=task/proj-224/move-status-test-button');
    expect(html).not.toContain('!/skill preqstation-dispatch');
  });

  it('shows only OpenClaw Telegram while hiding Hermes', () => {
    const html = renderTaskCopyActions({
      engine: 'codex',
      telegramEnabled: true,
      hermesTelegramEnabled: false,
    });

    expect(html).toContain('🦞 Telegram');
    expect(html).not.toContain('H Telegram');
    expect(html).toMatch(
      /task-dispatch-target-segments"[^>]*data-option-count="1"[^>]*data-selected-index="0"/,
    );
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).not.toContain('Channels');
  });

  it('shows Hermes when Hermes is the only Telegram target', () => {
    const html = renderTaskCopyActions({
      engine: 'codex',
      telegramEnabled: false,
      hermesTelegramEnabled: true,
    });

    expect(html).not.toContain('🦞 Telegram');
    expect(html).toContain('H Telegram');
    expect(html).toContain('aria-label="Selected target: H Telegram"');
    expect(html).toContain('/preqstation_dispatch@PreqHermesBot');
    expect(html).not.toContain('Channels');
  });

  it('initializes the selected target from the task dispatch target when it is available', () => {
    const html = renderTaskCopyActions({
      dispatchTarget: 'hermes-telegram',
      engine: 'codex',
    });

    expect(html).toContain('aria-label="Selected target: H Telegram"');
    expect(html).toContain('/preqstation_dispatch@PreqHermesBot');
  });

  it('falls back to OpenClaw Telegram when the stored target is a legacy Claude action', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'gemini-cli',
          action: legacyClaudeDispatchAction,
          objective: 'implement',
        },
      }),
    );

    const html = renderTaskCopyActions({ engine: 'codex' });

    expect(html).toContain('aria-label="Selected engine: Codex"');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
  });

  it('falls back to OpenClaw Telegram when the task target is unavailable in the current UI', () => {
    const html = renderTaskCopyActions({
      dispatchTarget: 'hermes-telegram',
      telegramEnabled: true,
      hermesTelegramEnabled: false,
    });

    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).not.toContain('aria-label="Selected target: H Telegram"');
  });

  it('falls back to Hermes when OpenClaw Telegram is unavailable, including legacy preferences', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'claude-code',
          action: 'copy-telegram',
          objective: 'ask',
        },
      }),
    );

    const html = renderTaskCopyActions({
      telegramEnabled: false,
      hermesTelegramEnabled: true,
      engine: 'claude-code',
    });

    expect(html).toContain('aria-label="Selected target: H Telegram"');
    expect(html).not.toContain('🦞 Telegram');
    expect(html).not.toContain('Channels');
  });

  it('shows plan and ask only for inbox tasks', () => {
    const html = renderTaskCopyActions({ status: 'inbox' });

    expect(html).toContain('Plan');
    expect(html).toContain('Ask');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('QA');
    expect(html).toContain(
      '!/skill preqstation-dispatch plan PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('shows review, QA, and ask only for ready tasks', () => {
    const html = renderTaskCopyActions({ status: 'ready' });

    expect(html).toContain('Review');
    expect(html).toContain('QA');
    expect(html).toContain('Ask');
    expect(html).toContain('data-option-count="3"');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Plan');
    expect(html).toContain(
      '!/skill preqstation-dispatch review PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('shows QA and ask only for done tasks', () => {
    const html = renderTaskCopyActions({ status: 'done' });

    expect(html).toContain('QA');
    expect(html).toContain('Ask');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Plan');
    expect(html).toContain(
      '!/skill preqstation-dispatch qa PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('hides dispatch for archived tasks', () => {
    const html = renderTaskCopyActions({ status: 'archived' });

    expect(html).not.toContain('Dispatch');
    expect(html).not.toContain('task-dispatch-panel');
  });

  it('keeps ask mode available with the note hint in the prompt', () => {
    localStorage.setItem(
      TASK_DISPATCH_PREFERENCES_STORAGE,
      JSON.stringify({
        todo: {
          engine: 'claude-code',
          action: 'send-telegram',
          objective: 'ask',
        },
      }),
    );

    const html = renderTaskCopyActions({
      noteMarkdown:
        '## Context\n\nCurrent note\n\n---\n\nAsk:\nSummarize around acceptance criteria',
    });

    expect(html).toContain('aria-label="Selected engine: Claude"');
    expect(html).toContain('aria-label="Selected mode: Ask"');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).toContain(
      '!/skill preqstation-dispatch ask PROJ-224 using claude-code branch_name=&quot;task/proj-224/move-status-test-button&quot; ask_hint=&quot;Summarize around acceptance criteria&quot;',
    );
  });
});
