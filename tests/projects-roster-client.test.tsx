// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectPortfolioCardSummary } from '@/app/(workspace)/(main)/projects/project-portfolio-card';
import { ProjectsRosterClient } from '@/app/(workspace)/(main)/projects/projects-roster-client';

vi.mock('@/app/(workspace)/(main)/projects/project-portfolio-card', () => ({
  ProjectPortfolioCard: ({ card }: { card: ProjectPortfolioCardSummary }) => (
    <article data-project-roster-card="true" data-testid={`project-card-${card.projectKey}`}>
      <h3>{card.name}</h3>
      <p>{card.description}</p>
      <span>{card.repoLabel}</span>
      <span>{card.vercelUrl}</span>
    </article>
  ),
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const noopAction = async () => undefined;

function card(overrides: Partial<ProjectPortfolioCardSummary>): ProjectPortfolioCardSummary {
  return {
    id: overrides.id ?? 'project-1',
    name: overrides.name ?? 'Active Project',
    projectKey: overrides.projectKey ?? 'ACTV',
    isPaused: overrides.isPaused ?? false,
    isArchived: overrides.isArchived ?? false,
    description: overrides.description ?? 'Vercel app and GitHub repo.',
    tone: overrides.tone ?? 'active',
    statusLabel: overrides.statusLabel ?? 'Active',
    openTaskCount: overrides.openTaskCount ?? 1,
    runningCount: overrides.runningCount ?? 0,
    queuedCount: overrides.queuedCount ?? 0,
    doneCount: overrides.doneCount ?? 0,
    openLabel: overrides.openLabel ?? 'OPEN',
    repoLabel: overrides.repoLabel ?? 'sonim1/active-project',
    repoUrl: overrides.repoUrl ?? 'https://github.com/sonim1/active-project',
    vercelUrl:
      overrides.vercelUrl === undefined ? 'https://active-project.vercel.app' : overrides.vercelUrl,
    bgImage: overrides.bgImage ?? null,
    detailsHref: overrides.detailsHref ?? '/project/ACTV',
    editHref: overrides.editHref ?? '/projects?panel=project-edit&projectKey=ACTV',
    lastActivityLabel: overrides.lastActivityLabel ?? 'Last activity 1h ago',
  };
}

function renderRoster() {
  return render(
    <MantineProvider>
      <ProjectsRosterClient
        allCards={[
          card({ id: 'project-1', name: 'Active Project' }),
          card({
            id: 'project-2',
            name: 'Paused Project',
            projectKey: 'PAUS',
            isPaused: true,
            description: 'Paused repo.',
            tone: 'paused',
            statusLabel: 'Paused',
            repoLabel: 'sonim1/paused-project',
            repoUrl: 'https://github.com/sonim1/paused-project',
            vercelUrl: null,
            detailsHref: '/project/PAUS',
            editHref: '/projects?panel=project-edit&projectKey=PAUS',
          }),
        ]}
        deleteProjectAction={noopAction}
        filterChips={[
          { label: 'All', value: 2, filter: 'all' },
          { label: 'Active', value: 1, filter: 'active' },
          { label: 'Paused', value: 1, filter: 'paused' },
          { label: 'Archived', value: 0, filter: 'archived' },
        ]}
        initialState={{
          activeAgentCount: 0,
          searchQuery: '',
          selectedProjectFilter: 'all',
          terminologyTaskPluralLower: 'tasks',
        }}
        pauseProjectAction={noopAction}
      />
    </MantineProvider>,
  );
}

describe('ProjectsRosterClient', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    window.history.pushState(null, '', '/projects?panel=project-edit&projectKey=ACTV');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('filters locally and syncs URL state without submitting the page', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    renderRoster();

    fireEvent.click(screen.getByRole('button', { name: 'Paused 1' }));

    expect(screen.queryByTestId('project-card-ACTV')).toBeNull();
    expect(screen.queryByTestId('project-card-PAUS')).not.toBeNull();
    expect(window.location.search).toContain('panel=project-edit');
    expect(window.location.search).toContain('projectKey=ACTV');
    expect(window.location.search).toContain('status=paused');
    expect(replaceState).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'All 2' }));
    fireEvent.change(screen.getByLabelText('Find a project'), {
      target: { value: 'vercel app' },
    });

    expect(screen.queryByTestId('project-card-ACTV')).not.toBeNull();
    expect(screen.queryByTestId('project-card-PAUS')).toBeNull();
    expect(window.location.search).toContain('q=vercel+app');
  });
});
