'use client';

import { Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

import classes from './task-edit-form.module.css';

export function TaskEditPanelSkeleton() {
  return (
    <div className={classes.root} data-testid="task-edit-loading-shell" aria-busy="true">
      <div className={classes.shell}>
        <div className={classes.sidebar}>
          <Paper withBorder p="md" radius="xl" className={classes.metadataSection}>
            <Stack gap="md">
              <Skeleton h={14} w="32%" radius="sm" />
              <Skeleton h={32} radius="md" />
              <SimpleGrid cols={2} spacing="sm">
                <Skeleton h={32} radius="md" />
                <Skeleton h={32} radius="md" />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <Skeleton h={32} radius="md" />
                <Skeleton h={32} radius="md" />
              </SimpleGrid>
              <Skeleton h={36} radius="md" />
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="xl">
            <Stack gap="sm">
              <Skeleton h={14} w="28%" radius="sm" />
              <Group gap="sm">
                <Skeleton h={28} w={84} radius="xl" />
                <Skeleton h={28} w={104} radius="xl" />
              </Group>
            </Stack>
          </Paper>
        </div>

        <div className={classes.mainColumn}>
          <Paper withBorder p="md" radius="xl" className={classes.notesCard}>
            <Stack gap="md" w="100%">
              <Group justify="space-between">
                <Skeleton h={16} w="22%" radius="sm" />
                <Skeleton h={28} w={120} radius="xl" />
              </Group>
              <Skeleton h={18} w="68%" radius="sm" />
              <Skeleton h={18} w="42%" radius="sm" />
              <Skeleton h={240} radius="lg" />
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="xl" className={classes.activityCard}>
            <Stack gap="sm">
              <Skeleton h={16} w="18%" radius="sm" />
              <Skeleton h={72} radius="md" />
              <Skeleton h={72} radius="md" />
            </Stack>
          </Paper>
        </div>

        <div className={classes.dispatchRail}>
          <Stack gap="sm">
            <Skeleton h={14} w="32%" radius="sm" />
            <SimpleGrid cols={3} spacing={4}>
              <Skeleton h={32} radius="sm" />
              <Skeleton h={32} radius="sm" />
              <Skeleton h={32} radius="sm" />
            </SimpleGrid>
            <SimpleGrid cols={3} spacing={4}>
              <Skeleton h={32} radius="sm" />
              <Skeleton h={32} radius="sm" />
              <Skeleton h={32} radius="sm" />
            </SimpleGrid>
            <Skeleton h={112} radius="md" />
            <Skeleton h={44} radius="md" />
          </Stack>
        </div>
      </div>
    </div>
  );
}
