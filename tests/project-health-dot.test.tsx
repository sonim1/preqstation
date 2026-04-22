import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectHealthDot } from '@/app/components/project-health-dot';

describe('app/components/project-health-dot', () => {
  it('renders the inactive label for assistive text', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProjectHealthDot health="inactive" />
      </MantineProvider>,
    );

    expect(html).toContain('Inactive - no recent work logs');
  });
});
