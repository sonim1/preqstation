'use client';

import { SimpleGrid } from '@mantine/core';
import { useEffect, useState } from 'react';

import { useOfflineStatus } from '@/app/components/offline-status-provider';
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
    <div data-projects-offline-snapshot="true">
      <div className={styles.summaryStrip}>
        {snapshot.summaryStrip.map((item) => (
          <div key={item.label} className={styles.summaryPill}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {snapshot.featuredCard ? (
        <div className={styles.topFeature} data-portfolio-featured="true">
          <ProjectPortfolioCard
            card={snapshot.featuredCard}
            deleteAction={noopAction}
            pauseAction={noopAction}
          />
        </div>
      ) : null}

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
    </div>
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
