// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KitchenModeSettings } from '@/app/components/kitchen-mode-settings';

describe('app/components/kitchen-mode-settings', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function stubMatchMedia() {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

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

  it('toggles when the larger switch row is clicked', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    stubMatchMedia();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MantineProvider>
        <KitchenModeSettings defaultValue={false} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Turn on Kitchen Mode' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'kitchen_mode', value: 'true' }),
      });
    });
    expect(screen.getByRole<HTMLInputElement>('switch', { name: /Kitchen Mode/ }).checked).toBe(
      true,
    );
  });

  it('does not dispatch twice when the switch label click also toggles the input', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    stubMatchMedia();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MantineProvider>
        <KitchenModeSettings defaultValue={false} />
      </MantineProvider>,
    );

    const row = screen.getByRole('button', { name: 'Turn on Kitchen Mode' });
    fireEvent.click(within(row).getByText('Kitchen Mode'));
    fireEvent.click(within(row).getByRole('switch', { name: /Kitchen Mode/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
