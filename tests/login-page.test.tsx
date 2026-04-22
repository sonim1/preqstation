import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  hasOwnerAccount: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  hasOwnerAccount: mocked.hasOwnerAccount,
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority: _priority,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; src: string }) =>
    React.createElement('img', { alt, src, ...props }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...props }, children),
}));

vi.mock('next/font/google', () => ({
  Outfit: () => ({
    className: 'font-outfit',
    style: { fontFamily: 'Outfit, sans-serif' },
  }),
}));

vi.mock('@/app/login/login-form', () => ({
  LoginForm: () => React.createElement('form', null, 'Login form'),
}));

vi.mock('@/app/login/owner-setup-form', () => ({
  OwnerSetupForm: () => React.createElement('form', null, 'Owner setup form'),
}));

import LoginPage from '@/app/login/page';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const loginPageSource = fs.readFileSync(path.join(process.cwd(), 'app/login/page.tsx'), 'utf8');

async function renderLoginPage(reason?: string) {
  const page = await LoginPage({
    searchParams: Promise.resolve(reason ? { reason } : {}),
  });

  return renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>);
}

describe('app/login/page', () => {
  beforeEach(() => {
    mocked.hasOwnerAccount.mockReset();
    mocked.hasOwnerAccount.mockResolvedValue(true);
  });

  it('does not render the color scheme toggle for guests', async () => {
    const html = await renderLoginPage();

    expect(html).not.toContain('Toggle color scheme');
  });

  it('keeps the visible dashboard shortcut in the tab order when it is rendered', async () => {
    const html = await renderLoginPage();

    expect(html).toContain('Go to Dashboard');
    expect(html).not.toContain('tabindex="-1"');
  });

  it('renders the owner setup form when no owner account exists yet', async () => {
    mocked.hasOwnerAccount.mockResolvedValueOnce(false);

    const html = await renderLoginPage();

    expect(html).toContain('Owner setup form');
    expect(html).not.toContain('Login form');
    expect(html).toContain('Create your owner account');
  });

  it('keeps the login brand mark on an aspect-ratio-safe render contract', () => {
    const brandMarkSourceMatch = loginPageSource.match(
      /<Image[\s\S]*?src="\/brand\/preqstation-app-icon\.svg"[\s\S]*?width=\{(\d+)\}[\s\S]*?height=\{(\d+)\}[\s\S]*?className="login-brand-mark"/,
    );
    const loginBrandRule = globalsCss.match(/\.login-brand-mark\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(brandMarkSourceMatch).not.toBeNull();
    expect(brandMarkSourceMatch?.[1]).not.toBe(brandMarkSourceMatch?.[2]);
    expect(loginBrandRule).toMatch(/width:\s*auto;/);
    expect(loginBrandRule).toMatch(/height:\s*28px;/);
  });
});
