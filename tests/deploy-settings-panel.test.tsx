// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function buildProject(
  overrides: Partial<{
    strategy: 'direct_commit' | 'feature_branch' | 'none';
    default_branch: string;
    auto_pr: boolean;
    commit_on_review: boolean;
    squash_merge: boolean;
  }> = {},
) {
  return {
    id: 'project-1',
    name: 'Project One',
    deployStrategy: {
      strategy: 'feature_branch' as const,
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: false,
      ...overrides,
    },
  };
}

function renderPanel(project = buildProject()) {
  return render(
    <MantineProvider>
      <DeploySettingsPanel
        action={vi.fn(async () => null)}
        singleProject
        defaultProjectId={project.id}
        projects={[project]}
      />
    </MantineProvider>,
  );
}

describe('app/components/panels/deploy-settings-panel', () => {
  beforeEach(() => {
    cleanup();

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

  it('explains the selected strategy before raw deploy controls', () => {
    renderPanel(buildProject({ strategy: 'feature_branch', auto_pr: true }));

    expect(screen.getByText(/Push a task branch and review work in a PR/i)).toBeTruthy();
    expect(
      screen.getByText(/A pull request can be opened automatically before review/i),
    ).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: /Strategy/i }), {
      target: { value: 'none' },
    });

    expect(screen.getByText(/Keep PREQ out of git and PR automation/i)).toBeTruthy();
    expect(screen.getByText(/Tasks stop after local code changes and task updates/i)).toBeTruthy();
  });

  it('shows only controls that apply to the selected strategy', () => {
    renderPanel(buildProject({ strategy: 'direct_commit', squash_merge: true }));

    expect(screen.getByRole('textbox', { name: /Default Branch/i })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: /Enable squash merge to default branch/i }),
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Auto-create PR on push/i })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: /Strategy/i }), {
      target: { value: 'none' },
    });

    expect(screen.queryByRole('textbox', { name: /Default Branch/i })).toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: /Enable squash merge to default branch/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: /Commit required before In Review/i }),
    ).toBeNull();
  });

  it('explains guardrails and operator risk in plain language', () => {
    renderPanel(
      buildProject({
        strategy: 'feature_branch',
        auto_pr: true,
        commit_on_review: true,
      }),
    );

    expect(
      screen.getAllByText(/Requires GitHub access on the coding agent/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/If review requires a push, missing GitHub auth will block the run/i),
    ).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: /Strategy/i }), {
      target: { value: 'direct_commit' },
    });

    expect(
      screen.getByText(/Squash merge combines worktree commits into one default-branch commit/i),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Disable this only when operators need the full merge history on the default branch/i,
      ),
    ).toBeTruthy();
  });
});
