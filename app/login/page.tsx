import { Alert, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
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
    <Container component="main" id="main-content" size="xs" className="login-container auth-shell">
      <Group justify="flex-end" mb="sm" gap="xs">
        {!needsAuth && ownerExists ? (
          <LinkButton href="/dashboard" variant="default" size="xs">
            Go to Dashboard
          </LinkButton>
        ) : null}
      </Group>
      {needsAuth ? (
        <Alert
          variant="light"
          className="auth-alert auth-alert--warning"
          icon={<IconInfoCircle size={16} />}
          mb="sm"
        >
          Authentication is required. Please sign in below.
        </Alert>
      ) : null}
      <Paper withBorder radius="lg" className="login-card auth-card">
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
            <div className="auth-brand-lockup">
              <Title
                component="h1"
                order={2}
                className={`brand-wordmark auth-card-title ${outfit.className}`}
                fw={800}
              >
                PREQSTATION
              </Title>
              <Text className="auth-card-subtitle" size="sm" mt={4}>
                AI Command Center
              </Text>
            </div>
          </Group>
          <Text className="auth-card-title" size="sm">
            Your personal command center where AI agents execute tasks
          </Text>
          <Text className="auth-card-subtitle" size="sm">
            Your private AI-powered command center
          </Text>
          {ownerExists ? (
            <LoginForm />
          ) : (
            <>
              <Text className="auth-card-title" fw={600}>
                Create your owner account
              </Text>
              <Text className="auth-card-subtitle" size="sm">
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
