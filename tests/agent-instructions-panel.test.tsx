import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactHooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
  useEffect: vi.fn(),
}));
const refreshMock = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: reactHooks.useActionState,
    useEffect: reactHooks.useEffect,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('@/lib/notifications', () => notifications);

import { AgentInstructionsPanel } from '@/app/components/panels/agent-instructions-panel';

describe('app/components/panels/agent-instructions-panel', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    reactHooks.useActionState.mockReset();
    reactHooks.useEffect.mockReset();
    notifications.showErrorNotification.mockReset();
    notifications.showSuccessNotification.mockReset();

    reactHooks.useActionState.mockReturnValue([null, vi.fn()]);
    reactHooks.useEffect.mockImplementation(() => undefined);
  });

  it('refreshes the route after a successful save', () => {
    const effects: Array<() => void | (() => void)> = [];
    reactHooks.useActionState.mockReturnValue([{ ok: true, message: 'Saved.' }, vi.fn()]);
    reactHooks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    renderToStaticMarkup(
      <MantineProvider>
        <AgentInstructionsPanel
          action={vi.fn(async () => null)}
          projectId="project-1"
          value="Always answer in Korean."
        />
      </MantineProvider>,
    );

    effects.forEach((effect) => {
      effect();
    });

    expect(notifications.showSuccessNotification).toHaveBeenCalledWith('Saved.');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('adds wrapping guards to the example code block so it cannot widen mobile panels', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AgentInstructionsPanel
          action={vi.fn(async () => null)}
          projectId="project-1"
          value="Always answer in Korean."
        />
      </MantineProvider>,
    );

    expect(html).toContain('max-width:100%');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('overflow-wrap:anywhere');
  });
});
