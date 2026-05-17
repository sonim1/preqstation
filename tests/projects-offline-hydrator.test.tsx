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
    description: 'Cached project',
    posture: { tone: 'steady' },
    openTaskCount: 1,
    readyCount: 0,
    holdCount: 0,
    openLabel: 'Open tasks',
    readyLabel: 'Ready',
    holdLabel: 'Hold',
    statusLabel: 'Active',
    priorityLabel: 'Priority 2',
    repoUrl: null,
    vercelUrl: null,
    detailsHref: `/project/${projectKey}`,
    boardHref: `/board/${projectKey}`,
    editHref: `/projects?panel=project-edit&projectKey=${projectKey}`,
    backgroundUrl: null,
    backgroundMode: 'fallback',
    weeklyActivity: [],
    weeklyActivityTotal: 0,
    slot: 'lead',
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

  it('stores the current projects page snapshot while online', async () => {
    renderWithMantine(
      <ProjectsOfflineHydrator
        snapshot={{
          featuredCard: card('PROJ', 'Project One'),
          resumeCards: [],
          quietCards: [],
          summaryStrip: [{ label: 'Live projects', value: 1 }],
        }}
      >
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
            featuredCard: expect.objectContaining({ projectKey: 'PROJ' }),
          }),
        }),
      );
    });
  });

  it('renders a saved projects snapshot while offline', async () => {
    useOfflineStatusMock.mockReturnValue({ online: false });
    getSnapshotMock.mockResolvedValue({
      payload: {
        featuredCard: card('CACH', 'Cached Project'),
        resumeCards: [],
        quietCards: [],
        summaryStrip: [{ label: 'Live projects', value: 1 }],
      },
    });

    renderWithMantine(
      <ProjectsOfflineHydrator
        snapshot={{
          featuredCard: null,
          resumeCards: [],
          quietCards: [],
          summaryStrip: [],
        }}
      >
        <div>No projects yet</div>
      </ProjectsOfflineHydrator>,
    );

    expect(await screen.findByText('CACH Cached Project')).toBeTruthy();
    expect(screen.queryByText('No projects yet')).toBeNull();
  });

  it('keeps the projects page header and content shell while offline', async () => {
    useOfflineStatusMock.mockReturnValue({ online: false });
    getSnapshotMock.mockResolvedValue({
      payload: {
        featuredCard: card('CACH', 'Cached Project'),
        resumeCards: [],
        quietCards: [],
        summaryStrip: [{ label: 'Live projects', value: 1 }],
      },
    });

    renderWithMantine(
      <ProjectsOfflineHydrator
        snapshot={{
          featuredCard: null,
          resumeCards: [],
          quietCards: [],
          summaryStrip: [],
        }}
      >
        <div>No projects yet</div>
      </ProjectsOfflineHydrator>,
    );

    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect(
      screen.getByText('Resume where work last moved. Keep the whole portfolio visible.'),
    ).toBeTruthy();
    expect(document.querySelector('[data-projects-offline-container="true"]')).toBeTruthy();
  });
});
