'use client';

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { useEffect } from 'react';

type AppErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppErrorPage({ error, reset }: AppErrorPageProps) {
  useEffect(() => {
    console.error('[app/error] unhandled route error:', error);
  }, [error]);

  return (
    <Container
      component="main"
      id="main-content"
      size="sm"
      py={{ base: 'lg', sm: 'xl' }}
      className="route-state-page"
    >
      <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }} className="route-state-card">
        <Stack gap="sm">
          <Text size="sm" fw={700} className="route-state-eyebrow">
            ERROR
          </Text>
          <Title component="h1" order={2} className="route-state-title">
            Something Went Wrong
          </Title>
          <Text className="route-state-description">
            An unexpected error occurred while rendering this page.
          </Text>
          {error.digest ? (
            <Text size="xs" className="route-state-reference">
              Ref: {error.digest}
            </Text>
          ) : null}
          <Group gap="xs" className="route-state-actions">
            <Button variant="default" onClick={reset} className="route-state-secondary-action">
              Try Again
            </Button>
            <Button component={Link} href="/dashboard" className="route-state-primary-action">
              Go to Dashboard
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
