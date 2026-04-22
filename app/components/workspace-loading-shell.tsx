import { Container, Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

import panelStyles from './panels.module.css';

export function WorkspaceLoadingShell() {
  return (
    <Container
      className="dashboard-root"
      fluid
      px={{ base: 'sm', sm: 'md', lg: 'lg', xl: 'xl' }}
      py={{ base: 'md', sm: 'xl' }}
    >
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Skeleton h={20} w={140} radius="sm" />
          <Group gap="xs" wrap="nowrap">
            <Skeleton h={32} w={32} radius="md" />
            <Skeleton h={30} w={150} radius="xl" />
            <Skeleton h={30} w={78} radius="md" />
          </Group>
        </Group>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'xl' }}
          className={panelStyles.heroPanel}
        >
          <Stack gap="lg">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={8}>
                <Skeleton h={30} w={220} radius="sm" />
                <Skeleton h={14} w={180} radius="sm" />
              </Stack>
              <Group gap="xs" wrap="wrap">
                <Skeleton h={34} w={108} radius="md" />
                <Skeleton h={34} w={108} radius="md" />
                <Skeleton h={34} w={120} radius="md" />
              </Group>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing={{ base: 'xs', sm: 'sm' }}>
              <Skeleton h={78} radius="md" />
              <Skeleton h={78} radius="md" />
              <Skeleton h={78} radius="md" />
              <Skeleton h={78} radius="md" />
              <Skeleton h={78} radius="md" />
              <Skeleton h={78} radius="md" />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p={{ base: 'md', sm: 'lg' }}
          className={panelStyles.sectionPanel}
        >
          <Group justify="space-between" mb="sm">
            <Skeleton h={18} w={130} radius="sm" />
            <Skeleton h={16} w={140} radius="sm" />
          </Group>
          <Group gap="xs" wrap="wrap">
            <Skeleton h={28} w={92} radius="md" />
            <Skeleton h={28} w={112} radius="md" />
            <Skeleton h={28} w={96} radius="md" />
            <Skeleton h={28} w={88} radius="md" />
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Paper
            withBorder
            radius="lg"
            p={{ base: 'md', sm: 'lg' }}
            className={panelStyles.sectionPanel}
          >
            <Stack gap="sm">
              <Skeleton h={24} w={180} radius="sm" />
              <Skeleton h={96} radius="md" />
              <Skeleton h={96} radius="md" />
            </Stack>
          </Paper>
          <Paper
            withBorder
            radius="lg"
            p={{ base: 'md', sm: 'lg' }}
            className={panelStyles.sectionPanel}
          >
            <Stack gap="sm">
              <Skeleton h={24} w={180} radius="sm" />
              <Skeleton h={96} radius="md" />
              <Skeleton h={96} radius="md" />
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
