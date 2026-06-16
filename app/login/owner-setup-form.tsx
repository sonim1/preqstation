'use client';

import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useActionState } from 'react';

import { registerOwnerAction } from './actions';

export function OwnerSetupForm() {
  const [state, formAction, isPending] = useActionState(registerOwnerAction, { error: null });

  return (
    <form action={formAction} id="owner-setup-form" name="owner-setup">
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

        <TextInput
          id="setup-email"
          type="email"
          name="email"
          label="Owner Email"
          placeholder="owner@example.com"
          autoComplete="username"
          suppressHydrationWarning
          required
        />
        <PasswordInput
          id="setup-password"
          name="password"
          label="Password"
          placeholder="Choose a strong password"
          autoComplete="new-password"
          suppressHydrationWarning
          required
        />
        <PasswordInput
          id="setup-confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          placeholder="Repeat password"
          autoComplete="new-password"
          suppressHydrationWarning
          required
        />

        <Button type="submit" loading={isPending} className="auth-primary-action">
          Create Owner Account
        </Button>
      </Stack>
    </form>
  );
}
