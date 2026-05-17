import { Container, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import type { CSSProperties } from 'react';

import headerStyles from '@/app/components/workspace-page-header.module.css';

import styles from './projects-page.module.css';

type ActivitySkeletonStyle = CSSProperties & {
  '--activity-bar-height': string;
};

const ACTIVITY_BAR_COUNT = 30;
const MOBILE_ACTIVITY_DAYS = 7;
const CARD_SKELETON_COUNT = 6;

const activityBars = Array.from({ length: ACTIVITY_BAR_COUNT }, (_, index) => ({
  height: index % 5 === 0 ? '0.45rem' : `${24 + ((index * 17) % 68)}%`,
  hiddenOnMobile: index < ACTIVITY_BAR_COUNT - MOBILE_ACTIVITY_DAYS,
}));

const cardTitleWidths = [148, 172, 132, 188, 156, 140];
const cardDescriptionWidths = [86, 72, 80, 68, 78, 74];
const footerWidths = [132, 116, 146, 122, 138, 128];

function ProjectsLoadingHeader() {
  return (
    <div className={styles.rosterHeader}>
      <header className={headerStyles.header} data-workspace-page-header="true" aria-hidden="true">
        <div className={headerStyles.copy}>
          <Skeleton h={32} w={280} maw="82vw" radius="sm" />
          <Skeleton h={16} w={430} maw="86vw" radius="sm" />
        </div>
      </header>
      <div className={styles.rosterActions}>
        <Skeleton h={30} w={104} radius="md" />
      </div>
    </div>
  );
}

function ProjectsActivitySkeleton() {
  return (
    <section
      className={styles.activityPanel}
      data-projects-loading-activity="true"
      aria-hidden="true"
    >
      <div className={styles.activityHeader}>
        <div className={styles.activityTitle}>
          <Skeleton h={16} w={16} radius="xl" />
          <Skeleton h={16} w={260} maw="70vw" radius="sm" />
        </div>
        <div className={styles.activityMeta}>
          <Skeleton h={13} w={52} radius="sm" />
          <Skeleton h={13} w={72} radius="sm" />
        </div>
      </div>
      <div
        className={styles.activityBarChart}
        data-projects-activity-chart="bar"
        data-projects-activity-range="desktop-30-mobile-7"
        role="presentation"
      >
        {activityBars.map((bar, index) => {
          const barStyle: ActivitySkeletonStyle = { '--activity-bar-height': bar.height };
          return (
            <div
              key={index}
              className={styles.activityBarWrap}
              data-projects-activity-mobile-hidden={bar.hiddenOnMobile ? 'true' : undefined}
            >
              <Skeleton
                className={styles.activityBar}
                data-projects-activity-loading-bar="true"
                radius="xs"
                style={barStyle}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.activityLegend} aria-hidden="true">
        <Skeleton h={11} w={72} radius="sm" />
        <Skeleton h={11} w={42} radius="sm" />
      </div>
    </section>
  );
}

function ProjectsToolbarSkeleton() {
  return (
    <div className={styles.toolbar} data-projects-loading-toolbar="true" aria-hidden="true">
      <Skeleton className={styles.searchInput} h={30} radius="md" />
      <div className={styles.filterChips}>
        {[64, 78, 84, 94].map((width) => (
          <Skeleton key={width} className={styles.filterChip} h={28} w={width} radius="xl" />
        ))}
      </div>
      <div className={styles.agentStatus} data-active="true">
        <Skeleton h={13} w={112} radius="sm" />
      </div>
    </div>
  );
}

function ProjectCardSkeleton({ index }: { index: number }) {
  return (
    <article className={styles.projectCard} data-project-roster-card-skeleton="true">
      <div className={styles.cardInner}>
        <div className={styles.cardTop}>
          <div className={styles.cardHeader}>
            <Skeleton className={styles.projectDot} radius="xl" />
            <div className={styles.cardHeading}>
              <Skeleton h={12} w={56} radius="sm" />
              <Skeleton h={20} w={cardTitleWidths[index]} maw="100%" radius="sm" />
            </div>
          </div>
          <div className={styles.cardMeta}>
            <Skeleton h={22} w={64} radius="xl" />
            <Skeleton h={28} w={28} radius="md" />
          </div>
        </div>

        <div className={styles.cardDescription}>
          <Skeleton h={13} w={`${cardDescriptionWidths[index]}%`} radius="sm" />
          <Skeleton h={13} w="58%" radius="sm" mt={6} />
        </div>

        <div className={styles.metricStrip} data-project-card-metrics="true">
          {[34, 42, 38, 30].map((width, metricIndex) => (
            <div key={metricIndex} className={styles.metric}>
              <Skeleton h={17} w={width} mx="auto" radius="sm" />
              <Skeleton h={10} w={42} mx="auto" radius="sm" />
            </div>
          ))}
        </div>

        <div className={styles.cardFooter}>
          <div className={styles.repoLabel}>
            <Skeleton h={12} w={footerWidths[index]} maw="100%" radius="sm" />
          </div>
          <div className={styles.activityLabel}>
            <Skeleton h={12} w={104} radius="sm" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProjectsLoadingShell() {
  return (
    <Container
      className="dashboard-root"
      data-projects-loading-shell="true"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
      aria-busy="true"
    >
      <Stack gap="md" className="dashboard-stack">
        <ProjectsLoadingHeader />
        <ProjectsActivitySkeleton />
        <ProjectsToolbarSkeleton />
        <section className={styles.portfolioSection} data-project-section="roster">
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm" className={styles.rosterGrid}>
            {Array.from({ length: CARD_SKELETON_COUNT }, (_, index) => (
              <ProjectCardSkeleton key={index} index={index} />
            ))}
          </SimpleGrid>
        </section>
      </Stack>
    </Container>
  );
}
