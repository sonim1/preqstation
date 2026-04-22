import { Tooltip } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconEye,
  IconPlayerPause,
  IconSubtask,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { ProjectCardMenu } from '@/app/components/project-card-menu';
import { ProjectCardWorklogSparkline } from '@/app/components/project-card-worklog-sparkline';

import styles from './projects-page.module.css';

type ProjectCardTone = 'steady' | 'heavy' | 'drifting' | 'quiet';
type ProjectCardSlot = 'lead' | 'support' | 'lane' | 'quiet';
type ProjectCardBackgroundMode = 'image' | 'fallback';
type WeeklyActivity = { date: string; count: number };

export type ProjectPortfolioCardSummary = {
  id: string;
  name: string;
  projectKey: string;
  isPaused: boolean;
  description: string;
  posture: {
    tone: ProjectCardTone;
  };
  openTaskCount: number;
  readyCount: number;
  holdCount: number;
  openLabel: string;
  readyLabel: string;
  holdLabel: string;
  repoUrl: string | null;
  vercelUrl: string | null;
  detailsHref: string;
  editHref: string;
  backgroundUrl: string | null;
  backgroundMode: ProjectCardBackgroundMode;
  weeklyActivity: WeeklyActivity[];
  weeklyActivityTotal: number;
  slot: ProjectCardSlot;
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
  const repoLinked = Boolean(card.repoUrl);
  const deployLinked = Boolean(card.vercelUrl);
  const connectionStatus = repoLinked && deployLinked ? 'complete' : 'warning';
  const connectionSummary = `Repository ${repoLinked ? 'connected' : 'missing'}. Deploy ${
    deployLinked ? 'connected' : 'missing'
  }.`;
  const cardStyle =
    card.backgroundMode === 'image' && card.backgroundUrl
      ? ({
          '--card-image': `url(${card.backgroundUrl})`,
        } as CSSProperties)
      : undefined;

  return (
    <article
      id={`project-${card.projectKey}`}
      className={styles.projectCard}
      data-project-card-slot={card.slot}
      data-project-card-background={card.backgroundMode}
      data-tone={card.posture.tone}
      style={cardStyle}
    >
      <div className={styles.cardInner}>
        <Link
          href={card.detailsHref}
          className={styles.cardLink}
          aria-label={`Open ${card.name} project details`}
        >
          <span className={styles.cardLinkLabel}>{card.name}</span>
        </Link>

        <div className={styles.cardTop}>
          <div className={styles.cardHeader}>
            <Tooltip
              classNames={{
                tooltip: styles.connectionTooltipSurface,
                arrow: styles.connectionTooltipArrow,
              }}
              label={
                <div className={styles.connectionTooltip}>
                  <div
                    className={styles.connectionTooltipLine}
                    data-state={repoLinked ? 'linked' : 'missing'}
                  >
                    <span>Repo</span>
                    <strong>{repoLinked ? 'Linked' : 'Missing'}</strong>
                  </div>
                  <div
                    className={styles.connectionTooltipLine}
                    data-state={deployLinked ? 'linked' : 'missing'}
                  >
                    <span>Deploy</span>
                    <strong>{deployLinked ? 'Linked' : 'Missing'}</strong>
                  </div>
                </div>
              }
              withArrow
              multiline
            >
              <span
                className={styles.connectionStatus}
                data-connectivity-status={connectionStatus}
                aria-label={connectionSummary}
                title={connectionSummary}
              >
                {connectionStatus === 'complete' ? (
                  <IconCircleCheck size={16} stroke={1.9} />
                ) : (
                  <IconAlertTriangle size={16} stroke={1.9} />
                )}
              </span>
            </Tooltip>
            <div className={styles.cardHeading}>
              <span className={styles.metaLabel}>{card.projectKey}</span>
              <span className={styles.metaDivider} aria-hidden="true">
                -
              </span>
              <h3 className={styles.cardTitle}>{card.name}</h3>
            </div>
          </div>
          <div className={styles.cardMeta}>
            <ProjectCardMenu
              canPause={!card.isPaused}
              editHref={card.editHref}
              pauseFormId={card.isPaused ? null : `pause-project-${card.id}`}
              projectId={card.id}
              projectName={card.name}
            />
          </div>
        </div>

        <div className={styles.metricStrip}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <IconSubtask size={13} />
              {card.openLabel}
            </span>
            <strong className={styles.metricValue}>{card.openTaskCount}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <IconEye size={13} />
              {card.readyLabel}
            </span>
            <strong className={styles.metricValue}>{card.readyCount}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <IconPlayerPause size={13} />
              {card.holdLabel}
            </span>
            <strong className={styles.metricValue}>{card.holdCount}</strong>
          </div>
        </div>

        {!card.isPaused ? (
          <form action={pauseAction} id={`pause-project-${card.id}`} style={{ display: 'none' }}>
            <input type="hidden" name="projectId" value={card.id} />
          </form>
        ) : null}
        <form action={deleteAction} id={`delete-project-${card.id}`} style={{ display: 'none' }}>
          <input type="hidden" name="projectId" value={card.id} />
        </form>

        <div className={styles.activityRail}>
          <div className={styles.activityMeta}>
            <span className={styles.activityLabel}>7d logs</span>
            <strong className={styles.activityValue}>{card.weeklyActivityTotal}</strong>
          </div>
          <ProjectCardWorklogSparkline
            data={card.weeklyActivity}
            total={card.weeklyActivityTotal}
          />
        </div>
      </div>
    </article>
  );
}
