'use client';

import { Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

import panelStyles from '@/app/components/panels.module.css';

export default function ProjectNotFoundPage() {
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
          <Title order={2}>Project Not Found</Title>
          <Text c="dimmed">
            The requested project was not found or you do not have access to it.
          </Text>
          <Button component={Link} href="/projects" w="fit-content">
            Back to Projects
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
