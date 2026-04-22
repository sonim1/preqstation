import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reactHooks = vi.hoisted(() => ({
  useActionState: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: reactHooks.useActionState,
  };
});

vi.mock('@/app/login/actions', () => ({
  loginAction: vi.fn(),
  registerOwnerAction: vi.fn(),
}));

import { LoginForm } from '@/app/login/login-form';
import { OwnerSetupForm } from '@/app/login/owner-setup-form';

function render(element: React.ReactElement) {
  return renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);
}

function expectAutocomplete(html: string, id: string, token: string) {
  expect(html).toMatch(
    new RegExp(
      `<input[^>]*(id="${id}"[^>]*autoComplete="${token}"|autoComplete="${token}"[^>]*id="${id}")`,
    ),
  );
}

function expectFormSemantics(html: string, id: string, name: string) {
  expect(html).toMatch(
    new RegExp(`<form[^>]*(id="${id}"[^>]*name="${name}"|name="${name}"[^>]*id="${id}")`),
  );
}

describe('login form autocomplete semantics', () => {
  beforeEach(() => {
    reactHooks.useActionState.mockReset();
    reactHooks.useActionState.mockReturnValue([{ error: null }, vi.fn(), false]);
  });

  it('marks the sign-in fields with username and current-password semantics', () => {
    const html = render(<LoginForm />);

    expectAutocomplete(html, 'login-email', 'username');
    expectAutocomplete(html, 'login-password', 'current-password');
    expectFormSemantics(html, 'login-form', 'login');
  });

  it('marks the owner setup fields with username and new-password semantics', () => {
    const html = render(<OwnerSetupForm />);

    expectAutocomplete(html, 'setup-email', 'username');
    expectAutocomplete(html, 'setup-password', 'new-password');
    expectAutocomplete(html, 'setup-confirm-password', 'new-password');
    expectFormSemantics(html, 'owner-setup-form', 'owner-setup');
  });
});
