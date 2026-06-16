'use client';

import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useActionState } from 'react';

import { loginAction } from './actions';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, { error: null });

  return (
    <form action={formAction} id="login-form" name="login">
      <Stack gap="md">
        {state.error ? (
          <Alert
            variant="light"
            className="auth-alert auth-alert--danger"
            icon={<IconAlertCircle size={16} />}
          >
            {state.error}
          </Alert>
        ) : null}

        {state.twoFactorRequired ? (
          <>
            <input type="hidden" name="intent" value="two-factor" />
            <TextInput
              id="login-totp-code"
              name="totpCode"
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              suppressHydrationWarning
              required
            />
          </>
        ) : (
          <>
            <TextInput
              id="login-email"
              type="email"
              name="email"
              label="Email"
              placeholder="owner@example.com"
              autoComplete="username"
              suppressHydrationWarning
              required
            />
            <PasswordInput
              id="login-password"
              name="password"
              label="Password"
              placeholder="Enter password"
              autoComplete="current-password"
              suppressHydrationWarning
              required
            />
          </>
        )}

        <Button type="submit" loading={isPending} className="auth-primary-action">
          {state.twoFactorRequired ? 'Verify' : 'Sign in'}
        </Button>
      </Stack>
    </form>
  );
}
