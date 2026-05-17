import type { CSSProperties } from 'react';

import styles from './projects-page.module.css';

type WorkspaceActivityPoint = {
  date: string;
  count: number;
};

type ActivityBarStyle = CSSProperties & {
  '--activity-bar-height': string;
};

function formatWorkLogCount(count: number) {
  return `${count} work log${count === 1 ? '' : 's'}`;
}

function getActivityLevel(count: number, peak: number) {
  if (count <= 0 || peak <= 0) return 0;
  const ratio = count / peak;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function getActivityBarHeight(count: number, peak: number) {
  if (count <= 0 || peak <= 0) return '0.45rem';
  return `${Math.max(18, Math.round((count / peak) * 100))}%`;
}

export function WorkspaceActivityChart({
  data,
  peak,
}: {
  data: WorkspaceActivityPoint[];
  peak: number;
}) {
  return (
    <div
      className={styles.activityBarChart}
      data-projects-activity-chart="bar"
      role="img"
      aria-label="Workspace activity across the last 30 days"
    >
      {data.map((point) => {
        const logCount = formatWorkLogCount(point.count);
        const barStyle: ActivityBarStyle = {
          '--activity-bar-height': getActivityBarHeight(point.count, peak),
        };

        return (
          <span key={point.date} className={styles.activityBarWrap}>
            <span
              className={styles.activityBar}
              data-activity-level={getActivityLevel(point.count, peak)}
              data-projects-activity-bar={point.date}
              aria-label={`${point.date}: ${logCount}`}
              tabIndex={0}
              style={barStyle}
            />
            <span className={styles.activityTooltip} role="tooltip">
              {point.date} · {logCount}
            </span>
          </span>
        );
      })}
    </div>
  );
}
