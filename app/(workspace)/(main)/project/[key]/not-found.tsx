'use client';

import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default function ProjectNotFoundPage() {
  return (
    <Container size="sm" py={{ base: 'lg', sm: 'xl' }} className="route-state-page">
      <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }} className="route-state-card">
        <Stack gap="sm">
          <Text size="sm" fw={700} className="route-state-eyebrow">
            404
          </Text>
          <Title order={2} className="route-state-title">
            Project Not Found
          </Title>
          <Text className="route-state-description">
            The requested project was not found or you do not have access to it.
          </Text>
          <Button
            component={Link}
            href="/projects"
            w="fit-content"
            className="route-state-primary-action"
          >
            Back to Projects
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
