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
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {state.error}
          </Alert>
        ) : null}

        <TextInput
          id="login-email"
          type="email"
          name="email"
          label="Email"
          placeholder="owner@example.com"
          autoComplete="username"
          required
        />
        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          placeholder="Enter password"
          autoComplete="current-password"
          required
        />

        <Button type="submit" loading={isPending}>
          Sign in
        </Button>
      </Stack>
    </form>
  );
}
