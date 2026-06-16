import { Badge } from '@mantine/core';
import { IconClock, IconGitBranch } from '@tabler/icons-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { ProjectCardMenu } from '@/app/components/project-card-menu';
import { getProjectPortfolioBgUrl } from '@/lib/project-backgrounds';

import styles from './projects-page.module.css';

type ProjectCardTone = 'active' | 'archived' | 'live' | 'paused' | 'queued' | 'stale';

export type ProjectPortfolioCardSummary = {
  id: string;
  name: string;
  projectKey: string;
  isPaused: boolean;
  isArchived: boolean;
  description: string;
  tone: ProjectCardTone;
  statusLabel: string;
  openTaskCount: number;
  runningCount: number;
  queuedCount: number;
  doneCount: number;
  openLabel: string;
  repoLabel: string;
  repoUrl: string | null;
  vercelUrl: string | null;
  bgImage: string | null;
  detailsHref: string;
  editHref: string;
  lastActivityLabel: string;
};

type ProjectPortfolioCardProps = {
  card: ProjectPortfolioCardSummary;
  deleteAction: (formData: FormData) => Promise<void>;
  pauseAction: (formData: FormData) => Promise<void>;
};

export function ProjectPortfolioCard({
  card,
  deleteAction,
  pauseAction,
}: ProjectPortfolioCardProps) {
  const isInactive = card.isPaused || card.isArchived;
  const statusTone = card.isArchived
    ? 'archived'
    : card.isPaused
      ? 'paused'
      : card.runningCount > 0
        ? 'live'
        : 'active';
  const backgroundUrl = getProjectPortfolioBgUrl(card.bgImage);
  const backgroundStyle = backgroundUrl
    ? ({
        '--project-card-bg-image': `url("${backgroundUrl}")`,
      } as CSSProperties)
    : undefined;

  return (
    <article
      id={`project-${card.projectKey}`}
      className={styles.projectCard}
      data-project-card-background={backgroundUrl ? 'image' : 'none'}
      data-project-card-tone={card.tone}
      data-project-roster-card="true"
      style={backgroundStyle}
    >
      <Link
        href={card.detailsHref}
        className={styles.cardLink}
        aria-label={`Open ${card.name} project details`}
      >
        <span className={styles.cardLinkLabel}>{card.name}</span>
      </Link>

      <div className={styles.cardInner}>
        <div className={styles.cardTop}>
          <div className={styles.cardHeader}>
            <span className={styles.projectDot} data-project-dot-tone={statusTone} />
            <div className={styles.cardHeading}>
              <span className={styles.metaLabel}>{card.projectKey}</span>
              <h3 className={styles.cardTitle}>{card.name}</h3>
            </div>
          </div>
          <div className={styles.cardMeta}>
            <Badge
              className={styles.statusBadge}
              color={isInactive ? 'gray' : card.runningCount > 0 ? 'cyan' : 'green'}
              size="xs"
              variant="light"
            >
              {card.statusLabel}
            </Badge>
            <ProjectCardMenu
              canPause={!isInactive}
              editHref={card.editHref}
              pauseFormId={isInactive ? null : `pause-project-${card.id}`}
              projectId={card.id}
              projectName={card.name}
            />
          </div>
        </div>

        <p className={styles.cardDescription}>{card.description}</p>

        <div className={styles.metricStrip} data-project-card-metrics="true">
          <div className={styles.metric}>
            <strong className={styles.metricValue}>{card.openTaskCount}</strong>
            <span className={styles.metricLabel}>{card.openLabel}</span>
          </div>
          <div className={styles.metric}>
            <strong className={styles.metricValue}>{card.runningCount}</strong>
            <span className={styles.metricLabel}>RUNNING</span>
          </div>
          <div className={styles.metric}>
            <strong className={styles.metricValue}>{card.queuedCount}</strong>
            <span className={styles.metricLabel}>QUEUED</span>
          </div>
          <div className={styles.metric}>
            <strong className={styles.metricValue}>{card.doneCount}</strong>
            <span className={styles.metricLabel}>DONE</span>
          </div>
        </div>

        {!isInactive ? (
          <form action={pauseAction} id={`pause-project-${card.id}`} style={{ display: 'none' }}>
            <input type="hidden" name="projectId" value={card.id} />
          </form>
        ) : null}
        <form action={deleteAction} id={`delete-project-${card.id}`} style={{ display: 'none' }}>
          <input type="hidden" name="projectId" value={card.id} />
        </form>

        <div className={styles.cardFooter}>
          <span className={styles.repoLabel}>
            <IconGitBranch size={12} />
            {card.repoLabel}
          </span>
          <span className={styles.activityLabel}>
            <IconClock size={12} />
            {card.lastActivityLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
