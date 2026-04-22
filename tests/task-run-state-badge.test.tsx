import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
});
