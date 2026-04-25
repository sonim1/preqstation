import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactHooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
  useEffect: vi.fn(),
}));
const refreshMock = vi.hoisted(() => vi.fn());
const showErrorNotification = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/notifications', () => ({
  showErrorNotification,
}));

import { DeploySettingsPanel } from '@/app/components/panels/deploy-settings-panel';

describe('app/components/panels/deploy-settings-panel', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    reactHooks.useActionState.mockReset();
    reactHooks.useEffect.mockReset();
    showErrorNotification.mockReset();

    reactHooks.useActionState.mockReturnValue([null, vi.fn()]);
    reactHooks.useEffect.mockImplementation(() => undefined);
  });

  it('refreshes the route after a successful save', () => {
    const effects: Array<() => void | (() => void)> = [];
    reactHooks.useActionState.mockReturnValue([{ ok: true }, vi.fn()]);
    reactHooks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      effects.push(effect);
    });

    renderToStaticMarkup(
      <MantineProvider>
        <DeploySettingsPanel
          action={vi.fn(async () => null)}
          singleProject
          defaultProjectId="project-1"
          projects={[
            {
              id: 'project-1',
              name: 'Project One',
              deployStrategy: {
                strategy: 'feature_branch',
                default_branch: 'main',
                auto_pr: false,
                commit_on_review: true,
                squash_merge: false,
              },
            },
          ]}
        />
      </MantineProvider>,
    );

    effects.forEach((effect) => {
      effect();
    });

    expect(showErrorNotification).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('adds wrapping guards to the prompt preview so it stays inside mobile cards', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DeploySettingsPanel
          action={vi.fn(async () => null)}
          singleProject
          defaultProjectId="project-1"
          projects={[
            {
              id: 'project-1',
              name: 'Project One',
              deployStrategy: {
                strategy: 'feature_branch',
                default_branch: 'main',
                auto_pr: false,
                commit_on_review: true,
                squash_merge: false,
              },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('max-width:100%');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('describes auto PR requirements in terms of gh auth or GitHub MCP', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DeploySettingsPanel
          action={vi.fn(async () => null)}
          singleProject
          defaultProjectId="project-1"
          projects={[
            {
              id: 'project-1',
              name: 'Project One',
              deployStrategy: {
                strategy: 'feature_branch',
                default_branch: 'main',
                auto_pr: true,
                commit_on_review: true,
                squash_merge: false,
              },
            },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Requires GitHub access on the coding agent');
    expect(html).toContain('gh auth');
    expect(html).toContain('GitHub MCP');
  });
});
