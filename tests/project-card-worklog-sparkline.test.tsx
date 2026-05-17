import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectCardWorklogSparkline } from '@/app/components/project-card-worklog-sparkline';

describe('app/components/project-card-worklog-sparkline', () => {
  it('renders a compact activity heat strip with count-based intensity levels', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectCardWorklogSparkline
          total={7}
          data={[
            { date: '2026-03-08', count: 0 },
            { date: '2026-03-09', count: 1 },
            { date: '2026-03-10', count: 2 },
            { date: '2026-03-11', count: 4 },
            { date: '2026-03-12', count: 6 },
            { date: '2026-03-13', count: 0 },
            { date: '2026-03-14', count: 3 },
          ]}
        />
      </MantineProvider>,
    );

    expect(html).toContain('data-project-card-activity-strip="true"');
    expect(html).toContain('aria-label="7 work logs across the last 7 days"');
    expect(html).toContain('data-activity-date="2026-03-08"');
    expect(html).toContain('data-activity-date="2026-03-14"');
    expect(html).toContain('data-activity-level="0"');
    expect(html).toContain('data-activity-level="1"');
    expect(html).toContain('data-activity-level="2"');
    expect(html).toContain('data-activity-level="3"');
    expect(html).toContain('data-activity-level="4"');
  });
});
