'use client';

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { useEffect } from 'react';

import panelStyles from './components/panels.module.css';

type AppErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppErrorPage({ error, reset }: AppErrorPageProps) {
  useEffect(() => {
    console.error('[app/error] unhandled route error:', error);
  }, [error]);

  return (
    <Container size="sm" py={{ base: 'lg', sm: 'xl' }}>
      <Paper
        withBorder
        radius="lg"
        p={{ base: 'lg', sm: 'xl' }}
        className={panelStyles.sectionPanel}
      >
        <Stack gap="sm">
          <Text size="sm" fw={700} c="dimmed">
            ERROR
          </Text>
          <Title order={2}>Something Went Wrong</Title>
          <Text c="dimmed">An unexpected error occurred while rendering this page.</Text>
          {error.digest ? (
            <Text size="xs" c="dimmed">
              Ref: {error.digest}
            </Text>
          ) : null}
          <Group gap="xs">
            <Button variant="default" onClick={reset}>
              Try Again
            </Button>
            <Button component={Link} href="/dashboard">
              Go to Dashboard
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
