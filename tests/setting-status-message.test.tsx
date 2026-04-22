import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SettingStatusMessage } from '@/app/components/setting-status-message';

describe('app/components/setting-status-message', () => {
  it('renders success messages as polite status text', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingStatusMessage tone="success" message="Saved" />
      </MantineProvider>,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Saved');
    expect(html).toContain('data-tone="success"');
  });

  it('renders error messages as assertive alerts', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SettingStatusMessage tone="error" message="Failed to save setting." />
      </MantineProvider>,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Failed to save setting.');
    expect(html).toContain('data-tone="error"');
  });
});
