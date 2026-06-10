// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getSnapshotMock = vi.hoisted(() => vi.fn());
const putSnapshotMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/offline/snapshot-store', () => ({
  getSnapshot: getSnapshotMock,
  putSnapshot: putSnapshotMock,
}));

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}));

vi.mock('@/app/(workspace)/(main)/projects/project-portfolio-card', () => ({
  ProjectPortfolioCard: ({ card }: { card: { name: string; projectKey: string } }) => (
    <article data-testid="offline-project-card">{`${card.projectKey} ${card.name}`}</article>
  ),
}));

import type { ProjectPortfolioCardSummary } from '@/app/(workspace)/(main)/projects/project-portfolio-card';
import { ProjectsOfflineHydrator } from '@/app/(workspace)/(main)/projects/projects-offline-hydrator';

function card(projectKey: string, name: string): ProjectPortfolioCardSummary {
  return {
    id: `project-${projectKey}`,
    name,
    projectKey,
    isPaused: false,
    isArchived: false,
    description: 'Cached project',
    tone: 'active',
    statusLabel: 'Active',
    openTaskCount: 1,
    runningCount: 0,
    queuedCount: 0,
    doneCount: 0,
    openLabel: 'OPEN',
    repoLabel: `sonim1/${projectKey}`,
    repoUrl: null,
    vercelUrl: null,
    bgImage: null,
    detailsHref: `/project/${projectKey}`,
    editHref: `/projects?panel=project-edit&projectKey=${projectKey}`,
    lastActivityLabel: 'Last activity 1h ago',
  };
}

function snapshot(cards: ProjectPortfolioCardSummary[]) {
  return {
    filterChips: [{ active: true, label: 'All', value: cards.length }],
    rosterCards: cards,
    workspaceActivity: Array.from({ length: 30 }, (_, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      count: index === 29 ? 2 : 0,
    })),
    workspaceActivityTotal: 2,
    workspacePeakLabel: 'peak d-0',
  };
}

function renderWithMantine(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('app/(workspace)/(main)/projects/projects-offline-hydrator', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineStatusMock.mockReturnValue({ online: true });
    getSnapshotMock.mockResolvedValue(null);
    putSnapshotMock.mockResolvedValue(undefined);
  });

  it('stores the current roster snapshot while online', async () => {
    renderWithMantine(
      <ProjectsOfflineHydrator snapshot={snapshot([card('PROJ', 'Project One')])}>
        <div>Online projects</div>
      </ProjectsOfflineHydrator>,
    );

    await waitFor(() => {
      expect(putSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'projects:index',
          kind: 'projects',
          entityKey: 'projects:index',
          payload: expect.objectContaining({
            rosterCards: [expect.objectContaining({ projectKey: 'PROJ' })],
          }),
        }),
      );
    });
  });

  it('renders a saved roster snapshot while offline', async () => {
    useOfflineStatusMock.mockReturnValue({ online: false });
    getSnapshotMock.mockResolvedValue({
      payload: snapshot([card('CACH', 'Cached Project')]),
    });

    renderWithMantine(
      <ProjectsOfflineHydrator snapshot={snapshot([])}>
        <div>No projects yet</div>
      </ProjectsOfflineHydrator>,
    );

    expect(await screen.findByText('CACH Cached Project')).toBeTruthy();
    expect(screen.queryByText('No projects yet')).toBeNull();
  });

  it('keeps the projects page roster shell while offline', async () => {
    useOfflineStatusMock.mockReturnValue({ online: false });
    getSnapshotMock.mockResolvedValue({
      payload: snapshot([card('CACH', 'Cached Project')]),
    });

    renderWithMantine(
      <ProjectsOfflineHydrator snapshot={snapshot([])}>
        <div>No projects yet</div>
      </ProjectsOfflineHydrator>,
    );

    expect(await screen.findByRole('heading', { name: 'Projects roster · 1 repos' })).toBeTruthy();
    expect(screen.getByText('Workspace activity')).toBeTruthy();
    expect(screen.getByText('1 project')).toBeTruthy();
    expect(document.querySelector('[data-projects-offline-container="true"]')).toBeTruthy();
    expect(document.querySelector('[data-projects-activity-chart="bar"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-projects-activity-bar]')).toHaveLength(30);
    expect(document.querySelectorAll('[data-projects-activity-mobile-hidden="true"]')).toHaveLength(
      23,
    );
    expect(screen.getByLabelText('2026-03-30: 2 work logs')).toBeTruthy();
    expect(screen.getByText('2026-03-30 · 2 work logs')).toBeTruthy();
    expect(document.querySelector('[data-project-section="roster"]')).toBeTruthy();
  });
});
