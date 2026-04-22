import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AutoSaveIndicator } from '@/app/components/auto-save-indicator';

describe('app/components/auto-save-indicator', () => {
  it('renders saving and saved states inside the same status slot', () => {
    const savingHtml = renderToStaticMarkup(
      <MantineProvider>
        <AutoSaveIndicator status="saving" />
      </MantineProvider>,
    );
    const savedHtml = renderToStaticMarkup(
      <MantineProvider>
        <AutoSaveIndicator status="saved" />
      </MantineProvider>,
    );

    expect(savingHtml).toContain('autosave-indicator-slot');
    expect(savedHtml).toContain('autosave-indicator-slot');
  });
});
