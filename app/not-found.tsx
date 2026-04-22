'use client';

import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

import panelStyles from './components/panels.module.css';

export default function NotFoundPage() {
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
            404
          </Text>
          <Title order={2}>Page Not Found</Title>
          <Text c="dimmed">The page you requested does not exist, or it may have been moved.</Text>
          <Button component={Link} href="/" w="fit-content">
            Back to Main
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
