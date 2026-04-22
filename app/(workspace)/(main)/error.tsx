'use client';

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { useEffect } from 'react';

import panelStyles from '@/app/components/panels.module.css';

type WorkspaceErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WorkspaceErrorPage({ error, reset }: WorkspaceErrorPageProps) {
  useEffect(() => {
    console.error('[WorkspaceError]', error);
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
          <Title order={2}>Something went wrong</Title>
          <Text c="dimmed">
            An unexpected error occurred while loading this page. You can try again or go back to
            the dashboard.
          </Text>
          {error.digest ? (
            <Text size="xs" c="dimmed">
              Ref: {error.digest}
            </Text>
          ) : null}
          <Group>
            <Button onClick={reset} variant="filled">
              Try again
            </Button>
            <Button component={Link} href="/projects" variant="default">
              Go to Dashboard
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
