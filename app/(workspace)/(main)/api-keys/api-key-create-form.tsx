'use client';

import { Alert, Code, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { useActionState } from 'react';

import { SubmitButton } from '@/app/components/submit-button';
import { API_TOKEN_NAME_MAX_LENGTH } from '@/lib/content-limits';

import { createApiKeyAction } from './actions';

const initialState = { token: null as string | null, error: null as string | null };

export function ApiKeyCreateForm() {
  const [state, formAction] = useActionState(createApiKeyAction, initialState);

  return (
    <Stack gap="md">
      <Title order={3}>Create API Key</Title>
      <form action={formAction}>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            name="name"
            label="Key Name"
            defaultValue="PREQSTATION Agent"
            maxLength={API_TOKEN_NAME_MAX_LENGTH}
            placeholder="PREQSTATION Agent"
            required
          />
          <NativeSelect
            name="expiresInDays"
            label="Expires In"
            defaultValue="90"
            data={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '180', label: '180 days' },
              { value: '365', label: '365 days' },
              { value: '', label: 'Never expires' },
            ]}
          />
          <SubmitButton>Create Key</SubmitButton>
        </Group>
      </form>

      {state.error ? <Alert color="red">{state.error}</Alert> : null}

      {state.token ? (
        <Alert color="green" title="New API key (shown once)">
          <Text size="sm" mb={8}>
            Copy and store this token now. It will not be displayed again.
          </Text>
          <Code block>{state.token}</Code>
        </Alert>
      ) : null}

      <Alert color="blue" title="Skill Environment Variables">
        <Text size="sm">Use this with your skill config:</Text>
        <Code
          block
        >{`PREQSTATION_API_URL=https://your-domain.vercel.app\nPREQSTATION_TOKEN=preq_xxxxx`}</Code>
      </Alert>
    </Stack>
  );
}
