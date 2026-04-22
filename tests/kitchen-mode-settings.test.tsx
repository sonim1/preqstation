import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KitchenModeSettings } from '@/app/components/kitchen-mode-settings';

describe('app/components/kitchen-mode-settings', () => {
  it('renders the kitchen mode toggle with the mapped terminology examples', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <KitchenModeSettings defaultValue />
      </MantineProvider>,
    );

    expect(html).toContain('Kitchen Mode');
    expect(html).toContain('Task -&gt; Ticket');
    expect(html).toContain('Ready -&gt; Pass');
    expect(html).toContain('Done -&gt; Order Up');
    expect(html).toContain('Hold -&gt; 86&#x27;d');
    expect(html).toContain('checked');
  });
});
