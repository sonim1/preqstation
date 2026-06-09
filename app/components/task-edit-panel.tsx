'use client';

import { lazy, Suspense } from 'react';

import { EmptyState } from '@/app/components/empty-state';

import { TaskEditPanelSkeleton } from './task-edit-panel-skeleton';
import {
  TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY,
  TASK_EDIT_PANEL_RESIZE_STORAGE_KEY,
} from './task-edit-panel-storage';
import type { TaskEditPanelProps } from './task-edit-panel-types';
import { TaskPanelModal } from './task-panel-modal';
import { useTerminology } from './terminology-provider';

const LoadedTaskEditPanel = lazy(() =>
  import('./task-edit-panel-loaded').then((mod) => ({ default: mod.LoadedTaskEditPanel })),
);

function LoadingTaskEditPanel({
  closeHref,
  onClose,
  opened = true,
  size = '80rem',
}: Pick<TaskEditPanelProps, 'closeHref' | 'onClose' | 'opened' | 'size'>) {
  return (
    <TaskPanelModal
      opened={opened}
      title="Edit Task"
      closeHref={closeHref}
      closeOnEscape
      onClose={onClose}
      fullscreenStorageKey={TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
      resizableStorageKey={TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}
      size={size}
    >
      <TaskEditPanelSkeleton />
    </TaskPanelModal>
  );
}

export function TaskEditPanel({
  closeHref,
  isLoading = false,
  onClose,
  opened = true,
  size = '80rem',
  ...loadedProps
}: TaskEditPanelProps) {
  if (isLoading) {
    return (
      <LoadingTaskEditPanel closeHref={closeHref} onClose={onClose} opened={opened} size={size} />
    );
  }

  return (
    <Suspense
      fallback={
        <LoadingTaskEditPanel closeHref={closeHref} onClose={onClose} opened={opened} size={size} />
      }
    >
      <LoadedTaskEditPanel
        closeHref={closeHref}
        onClose={onClose}
        opened={opened}
        size={size}
        {...loadedProps}
      />
    </Suspense>
  );
}

export function EmptyTaskEditPanel({
  closeHref,
  onClose,
  opened = true,
  size = '80rem',
}: {
  closeHref: string;
  onClose?: () => void;
  opened?: boolean;
  size?: string;
}) {
  const terminology = useTerminology();

  return (
    <TaskPanelModal
      opened={opened}
      title={`Edit ${terminology.task.singular}`}
      closeHref={closeHref}
      onClose={onClose}
      fullscreenStorageKey={TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
      resizableStorageKey={TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}
      size={size}
    >
      <EmptyState compact title={`${terminology.task.singular} not found`} />
    </TaskPanelModal>
  );
}
