import { Alert, Container, Group, Paper, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import Image from 'next/image';

import { LinkButton } from '@/app/components/link-button';
import { outfit } from '@/app/fonts';
import { hasOwnerAccount } from '@/lib/auth';

import { LoginForm } from './login-form';
import { OwnerSetupForm } from './owner-setup-form';

type LoginPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const needsAuth = params.reason === 'auth';
  const ownerExists = await hasOwnerAccount();

  return (
    <Container size="xs" className="login-container">
      <Group justify="flex-end" mb="sm" gap="xs">
        {!needsAuth && ownerExists ? (
          <LinkButton href="/dashboard" variant="default" size="xs">
            Go to Dashboard
          </LinkButton>
        ) : null}
      </Group>
      {needsAuth ? (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />} mb="sm">
          Authentication is required. Please sign in below.
        </Alert>
      ) : null}
      <Paper withBorder shadow="sm" radius="lg" className="login-card">
        <Stack gap="sm">
          <Group gap="sm" wrap="nowrap">
            <Image
              src="/brand/preqstation-app-icon.svg"
              alt=""
              width={32}
              height={28}
              className="login-brand-mark"
              priority
            />
            <div>
              <Text className={`brand-wordmark ${outfit.className}`} fw={800} size="xl">
                PREQSTATION
              </Text>
              <Text c="dimmed" size="sm" mt={4}>
                AI Command Center
              </Text>
            </div>
          </Group>
          <Text size="sm">Your personal command center where AI agents execute tasks</Text>
          <Text c="dimmed" size="sm">
            Your private AI-powered command center
          </Text>
          {ownerExists ? (
            <LoginForm />
          ) : (
            <>
              <Text fw={600}>Create your owner account</Text>
              <Text c="dimmed" size="sm">
                Set up the first owner account for this Preq Station instance. After that, the setup
                form is hidden and the normal login flow takes over.
              </Text>
              <OwnerSetupForm />
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
