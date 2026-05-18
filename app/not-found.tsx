'use client';

import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <Container size="sm" py={{ base: 'lg', sm: 'xl' }} className="route-state-page">
      <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }} className="route-state-card">
        <Stack gap="sm">
          <Text size="sm" fw={700} className="route-state-eyebrow">
            404
          </Text>
          <Title order={2} className="route-state-title">
            Page Not Found
          </Title>
          <Text className="route-state-description">
            The page you requested does not exist, or it may have been moved.
          </Text>
          <Button component={Link} href="/" w="fit-content" className="route-state-primary-action">
            Back to Main
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
