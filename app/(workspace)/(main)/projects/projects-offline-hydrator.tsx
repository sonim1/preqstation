'use client';

import { SimpleGrid, Stack } from '@mantine/core';
import { IconActivity, IconFolders } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useOfflineStatus } from '@/app/components/offline-status-provider';
import { WorkspacePageHeader } from '@/app/components/workspace-page-header';
import { getSnapshot, putSnapshot } from '@/lib/offline/snapshot-store';

import { ProjectPortfolioCard, type ProjectPortfolioCardSummary } from './project-portfolio-card';
import styles from './projects-page.module.css';
import { WorkspaceActivityChart } from './workspace-activity-chart';

export type ProjectsOfflineSnapshotPayload = {
  filterChips: Array<{ active: boolean; label: string; value: number }>;
  rosterCards: ProjectPortfolioCardSummary[];
  workspaceActivity: Array<{ date: string; count: number }>;
  workspaceActivityTotal: number;
  workspacePeakLabel: string;
};

const PROJECTS_SNAPSHOT_ID = 'projects:index';

const noopAction = async () => undefined;

function hasProjectCards(snapshot: ProjectsOfflineSnapshotPayload) {
  return snapshot.rosterCards.length > 0;
}

function OfflineProjectsView({ snapshot }: { snapshot: ProjectsOfflineSnapshotPayload }) {
  const peak = snapshot.workspaceActivity.reduce((max, point) => Math.max(max, point.count), 0);

  return (
    <Stack gap="md" className="dashboard-stack" data-projects-offline-snapshot="true">
      <div className={styles.rosterHeader}>
        <WorkspacePageHeader
          icon={IconFolders}
          title={`Projects roster · ${snapshot.rosterCards.length} repos`}
          description="Workspace activity, live agent state, and repo readiness at a glance."
        />
      </div>

      <section className={styles.activityPanel} data-projects-offline-container="true">
        <div className={styles.activityHeader}>
          <span className={styles.activityTitle}>
            <IconActivity size={16} aria-hidden="true" />
            Workspace activity
            <span aria-hidden="true">·</span>
            <span className={styles.activityRangeDesktop}>last 30 days</span>
            <span className={styles.activityRangeMobile}>last 7 days</span>
            <span aria-hidden="true">·</span>
            <span>
              {snapshot.rosterCards.length} project
              {snapshot.rosterCards.length === 1 ? '' : 's'}
            </span>
          </span>
          <span className={styles.activityMeta}>
            <strong>{snapshot.workspaceActivityTotal}</strong> logs
            <span>{snapshot.workspacePeakLabel}</span>
          </span>
        </div>
        <WorkspaceActivityChart data={snapshot.workspaceActivity} peak={peak} />
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filterChips} aria-label="Project filters">
          {snapshot.filterChips.map((chip) => (
            <span key={chip.label} className={styles.filterChip} data-active={chip.active}>
              {chip.label} {chip.value}
            </span>
          ))}
        </div>
        <span className={styles.agentStatus}>offline snapshot</span>
      </div>

      <section className={styles.portfolioSection} data-project-section="roster">
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm" className={styles.rosterGrid}>
          {snapshot.rosterCards.map((card) => (
            <ProjectPortfolioCard
              key={card.id}
              card={card}
              deleteAction={noopAction}
              pauseAction={noopAction}
            />
          ))}
        </SimpleGrid>
      </section>
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
