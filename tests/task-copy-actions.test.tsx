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
    IconChevronDown: icon('chevron-down'),
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
      /task-dispatch-mode-segments"[^>]*data-option-count="1"[^>]*data-selected-index="0"/,
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
    expect(html).not.toContain('Ask');
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
      '!/preqstation dispatch implement PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
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
    expect(html).toContain('task-dispatch-bottom-picker');
    expect(html).toContain('aria-label="Engine: Codex"');
    expect(html).toContain('aria-label="Target: Hermes Telegram"');
    expect(html).toContain('aria-label="Mode: Implement"');
    expect(html).toContain('Prompt');
    expect(html).toContain('data-task-dispatch-prompt');
    expect(html).not.toContain('aria-label="Message"');
    expect(html).not.toContain('task-dispatch-bottom-message-field');
    expect(html).not.toContain('>Ask<');
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

  it('omits bottom message ask_hint from dispatch payloads', async () => {
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
    });

    fireEvent.click(screen.getByRole('button', { name: /^send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(options?.body))).toEqual({
      taskKey: 'PROJ-224',
      message:
        '!/preqstation dispatch implement PROJ-224 using codex branch_name="task/proj-224/move-status-test-button"',
    });
    expect(String(options?.body)).not.toContain('ask_hint');
  });

  it('renders styled bottom dropdown menus with icons, details, and selected state', async () => {
    renderTaskCopyActionsClient({ placement: 'bottom' });

    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Engine' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Engine: Codex' }));
    expect(await screen.findByRole('menuitem', { name: /Claude/, hidden: true })).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: /Codex/, hidden: true }).getAttribute('data-selected'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: /Gemini/, hidden: true }));
    expect(screen.getByRole('button', { name: 'Engine: Gemini' })).toBeTruthy();
    expect(screen.getByText(/using gemini-cli/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Target: Telegram' }));
    expect(
      await screen.findByRole('menuitem', { name: /OpenClaw Telegram/, hidden: true }),
    ).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Hermes Telegram/, hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: /Hermes Telegram/, hidden: true }));
    expect(screen.getByRole('button', { name: 'Target: Hermes Telegram' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mode: Implement' }));
    expect(await screen.findByRole('menuitem', { name: /Implement/, hidden: true })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Ask/, hidden: true })).toBeNull();

    expect(
      JSON.parse(window.localStorage.getItem(TASK_DISPATCH_PREFERENCES_STORAGE) ?? '{}'),
    ).toEqual({
      todo: {
        engine: 'gemini-cli',
        action: 'send-hermes-telegram',
        objective: 'implement',
      },
    });
  });

  it('reports the current dispatch selection when the target changes', async () => {
    const onDispatchSelectionChange = vi.fn();

    renderTaskCopyActionsClient({
      placement: 'bottom',
      onDispatchSelectionChange,
    });

    await waitFor(() => {
      expect(onDispatchSelectionChange).toHaveBeenLastCalledWith({
        engine: 'codex',
        dispatchTarget: 'telegram',
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Target: Telegram' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Hermes Telegram/, hidden: true }));

    await waitFor(() => {
      expect(onDispatchSelectionChange).toHaveBeenLastCalledWith({
        engine: 'codex',
        dispatchTarget: 'hermes-telegram',
      });
    });
  });

  it('reports the next task dispatch defaults when the task changes', async () => {
    const firstTaskSelectionChange = vi.fn();
    const secondTaskSelectionChange = vi.fn();
    const { rerender } = renderTaskCopyActionsClient({
      taskKey: 'PROJ-224',
      engine: 'claude-code',
      dispatchTarget: 'hermes-telegram',
      placement: 'bottom',
      onDispatchSelectionChange: firstTaskSelectionChange,
    });

    await waitFor(() => {
      expect(firstTaskSelectionChange).toHaveBeenLastCalledWith({
        engine: 'claude-code',
        dispatchTarget: 'hermes-telegram',
      });
    });

    rerender(
      <MantineProvider>
        <TaskCopyActions
          taskKey="PROJ-225"
          branchName="task/proj-225/update-comment-dispatch"
          status="todo"
          engine="codex"
          dispatchTarget="telegram"
          telegramEnabled
          placement="bottom"
          onDispatchSelectionChange={secondTaskSelectionChange}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(secondTaskSelectionChange).toHaveBeenLastCalledWith({
        engine: 'codex',
        dispatchTarget: 'telegram',
      });
    });
    expect(secondTaskSelectionChange).not.toHaveBeenCalledWith({
      engine: 'claude-code',
      dispatchTarget: 'hermes-telegram',
    });
  });

  it('opens a bottom dropdown from the keyboard and focuses the selected option', async () => {
    renderTaskCopyActionsClient({ placement: 'bottom' });

    const trigger = screen.getByRole('button', { name: 'Engine: Codex' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const selectedOption = await screen.findByRole('menuitem', { name: /Codex/, hidden: true });
    await waitFor(() => expect(document.activeElement).toBe(selectedOption));
  });

  it('uses Mantine menu item navigation for bottom dropdown options', async () => {
    renderTaskCopyActionsClient({ placement: 'bottom' });

    fireEvent.click(screen.getByRole('button', { name: 'Engine: Codex' }));
    const firstOption = await screen.findByRole('menuitem', { name: /Claude/, hidden: true });
    const lastOption = screen.getByRole('menuitem', { name: /Gemini/, hidden: true });

    firstOption.focus();
    fireEvent.keyDown(firstOption, { key: 'End' });
    expect(document.activeElement).toBe(lastOption);

    fireEvent.keyDown(lastOption, { key: 'Home' });
    expect(document.activeElement).toBe(firstOption);
  });

  it('announces Hermes Telegram while sending a Hermes dispatch from the bottom bar', async () => {
    const send = createPendingTelegramSend();

    renderTaskCopyActionsClient({
      placement: 'bottom',
      dispatchTarget: 'hermes-telegram',
    });

    fireEvent.click(screen.getByRole('button', { name: /^send/i }));

    await waitFor(() => expect(send.fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status').textContent).toContain('Sending Hermes Telegram message.');
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
        '!/preqstation dispatch implement PROJ-224 using codex branch_name="task/proj-224/move-status-test-button"',
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
      '!/preqstation dispatch implement PROJ-224 using gemini-cli branch_name=&quot;task/proj-224/move-status-test-button&quot;',
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
    expect(html).not.toContain('!/preqstation_dispatch@PreqHermesBot');
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

  it('shows plan only for inbox tasks', () => {
    const html = renderTaskCopyActions({ status: 'inbox' });

    expect(html).toContain('Plan');
    expect(html).not.toContain('Ask');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('QA');
    expect(html).toContain(
      '!/preqstation dispatch plan PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('shows review and QA only for ready tasks', () => {
    const html = renderTaskCopyActions({ status: 'ready' });

    expect(html).toContain('Review');
    expect(html).toContain('QA');
    expect(html).not.toContain('Ask');
    expect(html).toContain('data-option-count="2"');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Plan');
    expect(html).toContain(
      '!/preqstation dispatch review PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('shows QA only for done tasks', () => {
    const html = renderTaskCopyActions({ status: 'done' });

    expect(html).toContain('QA');
    expect(html).not.toContain('Ask');
    expect(html).not.toContain('Review');
    expect(html).not.toContain('Implement');
    expect(html).not.toContain('Plan');
    expect(html).toContain(
      '!/preqstation dispatch qa PROJ-224 using codex branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
  });

  it('hides dispatch for archived tasks', () => {
    const html = renderTaskCopyActions({ status: 'archived' });

    expect(html).not.toContain('Dispatch');
    expect(html).not.toContain('task-dispatch-panel');
  });

  it('falls back from stored ask mode without adding a note hint to the prompt', () => {
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

    const html = renderTaskCopyActions();

    expect(html).toContain('aria-label="Selected engine: Claude"');
    expect(html).toContain('aria-label="Selected mode: Implement"');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).toContain(
      '!/preqstation dispatch implement PROJ-224 using claude-code branch_name=&quot;task/proj-224/move-status-test-button&quot;',
    );
    expect(html).not.toContain('ask_hint');
  });
});
