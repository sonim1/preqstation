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
const legacyClaudeDispatchAction = ['send', 'claude-code'].join('-');

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

describe('app/components/task-copy-actions', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
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
    expect(html).toContain('role="textbox"');
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain('data-task-dispatch-prompt');
    expect(html).not.toContain('<textarea');
    expect(html).toContain('aria-label="Copy dispatch prompt"');
    expect(html).toContain('aria-label="Send dispatch"');
    expect(html).toContain('Cmd+Enter');
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
    expect(html).toContain('/preq_dispatch@PreqHermesBot');
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
    expect(html).toContain('/preq_dispatch@PreqHermesBot');
    expect(html).not.toContain('Channels');
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
        '## Context\n\nCurrent note\n\n---\n\nAsk:\nAcceptance criteria 중심으로 정리해줘',
    });

    expect(html).toContain('aria-label="Selected engine: Claude"');
    expect(html).toContain('aria-label="Selected mode: Ask"');
    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
    expect(html).toContain(
      '!/skill preqstation-dispatch ask PROJ-224 using claude-code branch_name=&quot;task/proj-224/move-status-test-button&quot; ask_hint=&quot;Acceptance criteria 중심으로 정리해줘&quot;',
    );
  });
});
