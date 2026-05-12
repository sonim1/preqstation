// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TwoFactorSettings } from '@/app/components/two-factor-settings';

function renderStatic(element: React.ReactElement) {
  return renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);
}

function renderInteractive(element: React.ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>);
}

const actions = {
  startAction: vi.fn(async () => ({
    ok: true as const,
    otpauthUri: 'otpauth://totp/PREQSTATION:owner@example.com',
    setupToken: 'setup-token',
  })),
  confirmAction: vi.fn(async () => ({
    ok: true as const,
    message: 'Two-factor authentication enabled.',
  })),
  disableAction: vi.fn(async () => ({
    ok: true as const,
    message: 'Two-factor authentication disabled.',
  })),
};

describe('app/components/two-factor-settings', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
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
  });

  it('shows the setup button when 2FA is disabled', () => {
    const html = renderStatic(<TwoFactorSettings enabled={false} {...actions} />);

    expect(html).toContain('Set up authenticator app');
    expect(html).not.toContain('Authentication code');
  });

  it('shows the setup URI and code input after setup starts', async () => {
    renderInteractive(<TwoFactorSettings enabled={false} {...actions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator app' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('otpauth://totp/PREQSTATION:owner@example.com')).toBeTruthy();
    });
    expect(screen.getByLabelText(/Authentication code/)).toBeTruthy();
    expect(screen.getByDisplayValue('setup-token')).toBeTruthy();
  });

  it('shows enabled status and disable button when 2FA is active', () => {
    const html = renderStatic(<TwoFactorSettings enabled {...actions} />);

    expect(html).toContain('Enabled');
    expect(html).toContain('Disable');
    expect(html).not.toContain('Set up authenticator app');
  });
});
