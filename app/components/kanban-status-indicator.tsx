import { IconCheck } from '@tabler/icons-react';
import type { CSSProperties } from 'react';

import type { KanbanStatus } from '@/lib/kanban-helpers';

const STATUS_PROGRESS: Record<KanbanStatus, '0%' | '25%' | '50%' | '75%' | '100%'> = {
  inbox: '0%',
  todo: '25%',
  hold: '0%',
  ready: '75%',
  done: '100%',
  archived: '0%',
};

export function KanbanStatusIndicator({ status }: { status: KanbanStatus }) {
  const isPaused = status === 'hold';
  const style = {
    '--kanban-status-fill': STATUS_PROGRESS[status],
  } as CSSProperties;

  return (
    <span
      className={`kanban-status-indicator is-${status}${isPaused ? ' is-paused' : ''}`}
      style={style}
      aria-hidden="true"
      data-paused={isPaused ? 'true' : undefined}
    >
      <span className="kanban-status-indicator-fill" />
      {isPaused ? <span className="kanban-status-indicator-paused-dot" /> : null}
      {status === 'done' ? (
        <IconCheck size={9} stroke={3} className="kanban-status-indicator-check" />
      ) : null}
    </span>
  );
}
