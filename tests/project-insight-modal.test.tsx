import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Modal: ({
      children,
      title,
      opened,
    }: {
      children: React.ReactNode;
      title?: React.ReactNode;
      opened?: boolean;
    }) =>
      opened ? (
        <div data-modal>
          <div>{title}</div>
          {children}
        </div>
      ) : null,
  };
});

import { MantineProvider } from '@mantine/core';

import {
  isInsightExecuteDisabled,
  ProjectInsightModal,
  resolveInitialInsightTarget,
  resolveInsightTargets,
} from '@/app/components/project-insight-modal';

function renderInsightModal(props: Partial<React.ComponentProps<typeof ProjectInsightModal>> = {}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <ProjectInsightModal
        opened
        onClose={() => {}}
        selectedProject={{ id: 'project-1', name: 'Project', projectKey: 'PROJ' }}
        telegramEnabled
        hermesTelegramEnabled
        defaultEngine="claude-code"
        {...props}
      />
    </MantineProvider>,
  );
}

describe('app/components/project-insight-modal', () => {
  it('treats the first available target as active before the user touches the target selector', () => {
    const targetOptions = resolveInsightTargets({
      engineKey: 'claude-code',
      telegramEnabled: true,
      hermesTelegramEnabled: true,
    });

    expect(resolveInitialInsightTarget(targetOptions, null)).toBe('claude-code-channel');
    expect(
      isInsightExecuteDisabled({
        opened: true,
        selectedProject: { id: 'project-1', name: 'Project', projectKey: 'PROJ' },
        target: null,
        targetOptions,
        prompt: '브라우저 알림 기능 추가를 위한 다음 작업들을 정리해줘',
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it('renders the insight modal with a plain textarea and helper copy', () => {
    const html = renderInsightModal();

    expect(html).toContain('Create Inbox Tasks from Insight');
    expect(html).toContain(
      '현재 프로젝트와 입력한 내용을 바탕으로 다음 작업 인사이트를 정리하고 Inbox에 추가합니다.',
    );
    expect(html).toContain('aria-label="Insight prompt"');
    expect(html).toContain('textarea');
    expect(html).toContain('What should we break down?');
    expect(html).toContain('Connections 페이지 개편 작업을 나눠줘');
    expect(html).toContain('0/1200');
  });

  it('renders shared engine and target controls instead of the old action select', () => {
    const html = renderInsightModal({ defaultEngine: 'claude-code' });

    expect(html).toContain('task-dispatch-engine-segments');
    expect(html).toContain('task-dispatch-target-segments');
    expect(html).toContain('task-dispatch-prompt-shell');
    expect(html).toContain('aria-label="Copy dispatch prompt"');
    expect(html).toContain('Channels');
    expect(html).toContain('🦞 Telegram');
    expect(html).toContain('H Telegram');
    expect(html).toContain('aria-label="Selected target: Channels"');
    expect(html).not.toContain('aria-label="Insight action"');
    expect(html).not.toContain('Copy Telegram');
    expect(html).toContain('!/skill preqstation-dispatch insight PROJ using claude-code');
  });

  it('defaults non-Claude insight dispatch to Telegram when it is available', () => {
    const html = renderInsightModal({
      defaultEngine: 'codex',
      telegramEnabled: true,
      hermesTelegramEnabled: true,
    });

    expect(html).toContain('aria-label="Selected target: 🦞 Telegram"');
  });

  it('shows the resolved primary action label on first render for Claude Code', () => {
    const html = renderInsightModal({ defaultEngine: 'claude-code', telegramEnabled: true });

    expect(html).toContain('Queue Insight');
  });
});
