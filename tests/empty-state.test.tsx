import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/app/components/empty-state';

describe('EmptyState', () => {
  it('preserves the default icon rendering without a custom icon class', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <EmptyState
          icon={<span data-slot="icon" />}
          title="Nothing here"
          description="Try again later."
        />
      </MantineProvider>,
    );

    expect(html).toContain('Nothing here');
    expect(html).toContain('Try again later.');
    expect(html).toContain('data-slot="icon"');
    expect(html).not.toContain('custom-icon-surface');
  });

  it('adds a custom class to the icon wrapper only when requested', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <EmptyState
          icon={<span data-slot="icon" />}
          iconClassName="custom-icon-surface"
          title="Nothing here"
        />
      </MantineProvider>,
    );

    expect(html).toContain('custom-icon-surface');
    expect(html).toContain('data-slot="icon"');
  });
});
