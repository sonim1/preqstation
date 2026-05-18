import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <span {...props}>{children}</span>
  ),
  Tooltip: ({ children, label }: { children: React.ReactNode; label: React.ReactNode }) => (
    <div data-tooltip-label={label}>{children}</div>
  ),
}));

import { TaskRunStateBadge } from '@/app/components/task-run-state-badge';

describe('app/components/task-run-state-badge', () => {
  it('formats tooltip timestamps in yyyy-mm-dd HH:mm', () => {
    const html = renderToStaticMarkup(
      <TaskRunStateBadge runState="queued" runStateUpdatedAt="2026-03-18T10:03:00.000Z" />,
    );

    expect(html).toContain('Queued');
    expect(html).toContain('data-tooltip-label="2026-03-18 10:03"');
  });

  it('uses execution-state tokens for run-state badge colors', () => {
    const queuedHtml = renderToStaticMarkup(<TaskRunStateBadge runState="queued" />);
    const runningHtml = renderToStaticMarkup(<TaskRunStateBadge runState="running" />);

    expect(queuedHtml).toContain('data-run-state-badge="queued"');
    expect(queuedHtml).toContain('--badge-color:var(--ui-status-queued)');
    expect(queuedHtml).toContain('--badge-bd:1px solid var(--ui-status-queued-border)');
    expect(runningHtml).toContain('data-run-state-badge="running"');
    expect(runningHtml).toContain('--badge-color:var(--ui-status-running)');
    expect(runningHtml).toContain('--badge-bd:1px solid var(--ui-status-running-border)');
    expect(`${queuedHtml}${runningHtml}`).not.toContain('data-color=');
  });
});
