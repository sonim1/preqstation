// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeploySettingsPanel } from '@/app/components/panels/deploy-settings-panel';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const singleProject = [
  {
    id: 'project-1',
    name: 'Project One',
    deployStrategy: {
      strategy: 'feature_branch' as const,
      default_branch: 'main',
      auto_pr: false,
      commit_on_review: true,
      squash_merge: false,
    },
  },
];

describe('app/components/panels/deploy-settings-panel', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
  });

  it('shows manual-save guidance and keeps the prompt preview wrapped inside mobile cards', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DeploySettingsPanel
          action={vi.fn(async () => null)}
          singleProject
          defaultProjectId="project-1"
          projects={singleProject}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Changes stay local until you save.');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  it('surfaces dirty and saved states without a route refresh loop', async () => {
    const action = vi.fn(async () => ({
      ok: true as const,
      message: 'Deployment strategy saved.',
    }));

    render(
      <MantineProvider>
        <DeploySettingsPanel
          action={action}
          singleProject
          defaultProjectId="project-1"
          projects={singleProject}
        />
      </MantineProvider>,
    );

    const defaultBranchInput = screen.getByRole('textbox', { name: /Default Branch/i });

    fireEvent.change(defaultBranchInput, {
      target: { value: 'release' },
    });

    expect(screen.getByText('Unsaved changes.')).toBeTruthy();

    fireEvent.submit(defaultBranchInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeTruthy();
    });

    const firstCall = action.mock.calls[0] as unknown[] | undefined;
    const submittedFormData = firstCall?.[1] as FormData;
    expect(submittedFormData.get('projectId')).toBe('project-1');
    expect(submittedFormData.get('deploy_default_branch')).toBe('release');
  });

  it('surfaces inline save errors after submit', async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      message: 'Failed to save deployment settings.',
    }));

    render(
      <MantineProvider>
        <DeploySettingsPanel
          action={action}
          singleProject
          defaultProjectId="project-1"
          projects={singleProject}
        />
      </MantineProvider>,
    );

    const defaultBranchInput = screen.getByRole('textbox', { name: /Default Branch/i });

    fireEvent.change(defaultBranchInput, {
      target: { value: 'release' },
    });
    fireEvent.submit(defaultBranchInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Failed to save deployment settings.')).toBeTruthy();
    });
  });

  it('keeps the form dirty when edits continue after save starts', async () => {
    const request = deferred<{ ok: true }>();
    const action = vi.fn(async () => request.promise);

    render(
      <MantineProvider>
        <DeploySettingsPanel
          action={action}
          singleProject
          defaultProjectId="project-1"
          projects={singleProject}
        />
      </MantineProvider>,
    );

    const defaultBranchInput = screen.getByRole('textbox', { name: /Default Branch/i });

    fireEvent.change(defaultBranchInput, {
      target: { value: 'release' },
    });
    fireEvent.submit(defaultBranchInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(defaultBranchInput, {
      target: { value: 'release-candidate' },
    });

    await act(async () => {
      request.resolve({ ok: true });
      await Promise.resolve();
    });

    expect(screen.getByText('Unsaved changes.')).toBeTruthy();
    expect(screen.queryByText('Saved.')).toBeNull();
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
