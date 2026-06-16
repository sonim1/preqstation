'use client';

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { useEffect } from 'react';

type WorkspaceErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WorkspaceErrorPage({ error, reset }: WorkspaceErrorPageProps) {
  useEffect(() => {
    console.error('[WorkspaceError]', error);
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
            Something went wrong
          </Title>
          <Text className="route-state-description">
            An unexpected error occurred while loading this page. You can try again or go back to
            the dashboard.
          </Text>
          {error.digest ? (
            <Text size="xs" className="route-state-reference">
              Ref: {error.digest}
            </Text>
          ) : null}
          <Group className="route-state-actions">
            <Button onClick={reset} variant="filled" className="route-state-primary-action">
              Try again
            </Button>
            <Button
              component={Link}
              href="/projects"
              variant="default"
              className="route-state-secondary-action"
            >
              Go to Dashboard
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
