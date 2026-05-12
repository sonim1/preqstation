'use client';

import { Paper, SimpleGrid, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';

import { useOfflineStatus } from '@/app/components/offline-status-provider';
import panelStyles from '@/app/components/panels.module.css';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

import { ProjectPortfolioCard, type ProjectPortfolioCardSummary } from './project-portfolio-card';
import styles from './projects-page.module.css';

export type ProjectsOfflineSnapshotPayload = {
  featuredCard: ProjectPortfolioCardSummary | null;
  quietCards: ProjectPortfolioCardSummary[];
  resumeCards: ProjectPortfolioCardSummary[];
  summaryStrip: Array<{ label: string; value: number }>;
};

const PROJECTS_SNAPSHOT_ID = 'projects:index';

const noopAction = async () => undefined;

function hasProjectCards(snapshot: ProjectsOfflineSnapshotPayload) {
  return Boolean(
    snapshot.featuredCard || snapshot.resumeCards.length > 0 || snapshot.quietCards.length > 0,
  );
}

function OfflineProjectsView({ snapshot }: { snapshot: ProjectsOfflineSnapshotPayload }) {
  return (
    <Stack gap="md" className="dashboard-stack" data-projects-offline-snapshot="true">
      <WorkspacePageHeader
        title="Projects"
        description="Resume where work last moved. Keep the whole portfolio visible."
      />

      <div className={styles.topGrid}>
        <Paper
          withBorder
          radius="md"
          p={{ base: 'sm', sm: 'lg' }}
          className={`${panelStyles.sectionPanel} ${styles.topSection}`}
          data-projects-offline-container="true"
        >
          <div className={styles.summaryStrip}>
            {snapshot.summaryStrip.map((item) => (
              <div key={item.label} className={styles.summaryPill}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Paper>

        {snapshot.featuredCard ? (
          <div className={styles.topFeature} data-portfolio-featured="true">
            <ProjectPortfolioCard
              card={snapshot.featuredCard}
              deleteAction={noopAction}
              pauseAction={noopAction}
            />
          </div>
        ) : null}
      </div>

      {snapshot.resumeCards.length > 0 ? (
        <section className={styles.portfolioSection} data-project-section="resume">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
            {snapshot.resumeCards.map((card) => (
              <ProjectPortfolioCard
                key={card.id}
                card={card}
                deleteAction={noopAction}
                pauseAction={noopAction}
              />
            ))}
          </SimpleGrid>
        </section>
      ) : null}

      {snapshot.quietCards.length > 0 ? (
        <section className={styles.portfolioSection} data-project-section="quiet">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {snapshot.quietCards.map((card) => (
              <ProjectPortfolioCard
                key={card.id}
                card={card}
                deleteAction={noopAction}
                pauseAction={noopAction}
              />
            ))}
          </SimpleGrid>
        </section>
      ) : null}
    </Stack>
  );
}

export function ProjectsOfflineHydrator({
  children,
  snapshot,
}: {
  children: React.ReactNode;
  snapshot: ProjectsOfflineSnapshotPayload;
}) {
  const { online } = useOfflineStatus();
  const [offlineSnapshot, setOfflineSnapshot] = useState<ProjectsOfflineSnapshotPayload | null>(
    null,
  );

  useEffect(() => {
    if (!hasProjectCards(snapshot)) return;

    void putSnapshot<ProjectsOfflineSnapshotPayload>({
      id: PROJECTS_SNAPSHOT_ID,
      kind: 'projects',
      entityKey: PROJECTS_SNAPSHOT_ID,
      payload: snapshot,
      updatedAt: new Date().toISOString(),
    });
  }, [snapshot]);

  useEffect(() => {
    if (online) {
      return;
    }

    let active = true;
    void getSnapshot<ProjectsOfflineSnapshotPayload>(PROJECTS_SNAPSHOT_ID).then((record) => {
      if (active && record?.payload && hasProjectCards(record.payload)) {
        setOfflineSnapshot(record.payload);
      }
    });

    return () => {
      active = false;
    };
  }, [online]);

  if (!online && offlineSnapshot) {
    return <OfflineProjectsView snapshot={offlineSnapshot} />;
  }

  return <>{children}</>;
}
