'use client';

import { Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';

import classes from './task-edit-form.module.css';

export function TaskEditPanelSkeleton() {
  return (
    <div className={classes.root} data-testid="task-edit-loading-shell" aria-busy="true">
      <div className={classes.shell} data-layout="task-edit-shell">
        <div className={classes.mainColumn} data-panel="task-edit-main-column">
          <section
            className={`${classes.notesCard} ${classes.sectionSurface}`}
            data-panel="task-edit-notes-primary"
          >
            <Stack gap="md" className={classes.notesContent}>
              <Group justify="space-between">
                <Skeleton h={16} w="22%" radius="sm" />
                <Skeleton h={28} w={120} radius="xl" />
              </Group>
              <Skeleton h={18} w="68%" radius="sm" />
              <Skeleton h={18} w="42%" radius="sm" />
              <Skeleton radius="lg" className={classes.skeletonNotesEditor} />
            </Stack>
          </section>

          <section
            className={`${classes.activityCard} ${classes.sectionSurface}`}
            data-panel="task-edit-comments"
          >
            <Stack gap="md">
              <Skeleton h={16} w="18%" radius="sm" />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
            </Stack>
          </section>

          <section
            className={`${classes.activityCard} ${classes.sectionSurface}`}
            data-panel="task-edit-activity"
          >
            <Stack gap="md">
              <Skeleton h={16} w="18%" radius="sm" />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
            </Stack>
          </section>
        </div>

        <aside className={classes.sidebar} data-panel="task-edit-sidebar">
          <section
            className={`${classes.dispatchRail} ${classes.sectionSurface}`}
            data-panel="task-edit-dispatch"
          >
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
              <Skeleton radius="md" className={classes.skeletonPromptPreview} />
              <Skeleton h={44} radius="md" />
            </Stack>
          </section>

          <section
            className={`${classes.metadataSection} ${classes.sectionSurface}`}
            data-panel="task-edit-metadata"
          >
            <Stack gap="md">
              <Skeleton h={14} w="46%" radius="sm" />
              <div className={classes.settingsPanel} data-panel="task-edit-settings-card">
                <Stack gap="md">
                  <Skeleton h={32} radius="md" />
                  <SimpleGrid cols={2} spacing="sm">
                    <Skeleton h={32} radius="md" />
                    <Skeleton h={32} radius="md" />
                  </SimpleGrid>
                  <Skeleton h={32} radius="md" />
                  <Skeleton h={36} radius="md" />
                </Stack>
              </div>
            </Stack>
          </section>
        </aside>
      </div>
    </div>
  );
}
