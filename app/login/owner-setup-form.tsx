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
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
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
          required
        />
        <PasswordInput
          id="setup-password"
          name="password"
          label="Password"
          placeholder="Choose a strong password"
          autoComplete="new-password"
          required
        />
        <PasswordInput
          id="setup-confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          placeholder="Repeat password"
          autoComplete="new-password"
          required
        />

        <Button type="submit" loading={isPending}>
          Create Owner Account
        </Button>
      </Stack>
    </form>
  );
}
