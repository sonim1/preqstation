'use client';

import { Group, Skeleton, Stack } from '@mantine/core';

import classes from './task-edit-form.module.css';

export function TaskEditPanelSkeleton() {
  return (
    <div className={classes.root} data-testid="task-edit-loading-shell" aria-busy="true">
      <div className={classes.shell} data-layout="task-edit-shell">
        <div className={classes.mainColumn} data-panel="task-edit-main-column">
          <section
            className={classes.commandStrip}
            data-panel="task-edit-command-strip"
            aria-label="Task controls loading"
          >
            <div className={classes.metadataSection} data-panel="task-edit-metadata">
              <Stack gap="sm" className={`${classes.metaHeader} task-edit-meta-header`}>
                <Group gap="sm" wrap="wrap" className={classes.taskIdentityRow}>
                  <Skeleton h={34} w={112} radius="xl" />
                  <Skeleton h={18} w={148} radius="sm" />
                </Group>
              </Stack>
            </div>
            <div className={classes.settingsControls}>
              <Skeleton h={40} radius="md" />
            </div>
            <div className={classes.settingsControls}>
              <Skeleton h={40} radius="md" />
            </div>
            <div className={classes.skeletonCommandDispatch}>
              <Skeleton h={40} radius="md" />
              <Skeleton h={40} radius="md" />
              <Skeleton h={40} radius="md" />
              <Skeleton h={40} radius="md" />
              <Skeleton h={40} w={44} radius="md" />
              <Skeleton h={40} radius="md" />
            </div>
          </section>

          <section
            className={`${classes.notesCard} ${classes.mainSectionSurface}`}
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
            className={`${classes.activityCard} ${classes.mainSectionSurface}`}
            data-panel="task-edit-comments"
          >
            <Stack gap="md">
              <Skeleton h={16} w="18%" radius="sm" />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
            </Stack>
          </section>

          <section
            className={`${classes.activityCard} ${classes.mainSectionSurface}`}
            data-panel="task-edit-activity"
          >
            <Stack gap="md">
              <Skeleton h={16} w="18%" radius="sm" />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
              <Skeleton radius="md" className={classes.skeletonActivityRow} />
            </Stack>
          </section>
        </div>
      </div>
    </div>
  );
}
