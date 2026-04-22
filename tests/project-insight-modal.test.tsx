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
  resolveInitialInsightAction,
  resolveInsightActions,
} from '@/app/components/project-insight-modal';

function renderInsightModal(props: Partial<React.ComponentProps<typeof ProjectInsightModal>> = {}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <ProjectInsightModal
        opened
        onClose={() => {}}
        selectedProject={{ id: 'project-1', name: 'Project', projectKey: 'PROJ' }}
        telegramEnabled
        defaultEngine="claude-code"
        {...props}
      />
    </MantineProvider>,
  );
}

describe('app/components/project-insight-modal', () => {
  it('treats the first available action as active before the user touches the action select', () => {
    const actionOptions = resolveInsightActions({
      engineKey: 'claude-code',
      telegramEnabled: true,
    });

    expect(resolveInitialInsightAction(actionOptions, null)).toBe('send-claude-code');
    expect(
      isInsightExecuteDisabled({
        opened: true,
        selectedProject: { id: 'project-1', name: 'Project', projectKey: 'PROJ' },
        action: null,
        actionOptions,
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

  it('shows the Claude Code transport action when Claude Code is selected', () => {
    const html = renderInsightModal({ defaultEngine: 'claude-code' });

    expect(html).toContain('aria-label="Insight action"');
    expect(html).toContain('Send to Claude Code');
    expect(html).toContain('Send to Telegram');
    expect(html).toContain('Copy Telegram');
  });

  it('shows the resolved primary action label on first render for Claude Code', () => {
    const html = renderInsightModal({ defaultEngine: 'claude-code', telegramEnabled: true });

    expect(html).toContain('Queue Insight');
  });
});
