import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => ({
  ActionIcon: ({
    children,
    ...props
  }: React.ComponentProps<'button'> & {
    size?: number;
    radius?: string;
    variant?: string;
    color?: string;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Tooltip: ({
    children,
    events,
    label,
  }: {
    children?: React.ReactNode;
    events?: { hover?: boolean; focus?: boolean; touch?: boolean };
    label?: React.ReactNode;
  }) => (
    <div
      data-tooltip-label={label}
      data-tooltip-hover={String(events?.hover)}
      data-tooltip-focus={String(events?.focus)}
      data-tooltip-touch={String(events?.touch)}
    >
      {children}
    </div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => null,
}));

import { DashboardInfoHint } from '@/app/components/dashboard-info-hint';

describe('app/components/dashboard-info-hint', () => {
  it('enables help content for hover, keyboard focus, and touch input', () => {
    const html = renderToStaticMarkup(
      <DashboardInfoHint label="Service Pace" tooltip="Weekly work-log rhythm." />,
    );

    expect(html).toContain('data-tooltip-label="Weekly work-log rhythm."');
    expect(html).toContain('data-tooltip-hover="true"');
    expect(html).toContain('data-tooltip-focus="true"');
    expect(html).toContain('data-tooltip-touch="true"');
    expect(html).toContain('aria-label="Service Pace help"');
  });
});
