'use client';

import { Badge } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AutoSaveIndicator } from '@/app/components/auto-save-indicator';
import { EmptyState } from '@/app/components/empty-state';
import { boardStatusLabel } from '@/lib/kanban-helpers';
import { TASK_STATUS_COLORS } from '@/lib/task-meta';

import { TaskEditForm, type TaskEditFormProps, useTaskEditFormController } from './task-edit-form';
import { TaskEditHeaderTitle } from './task-edit-header-title';
import { TaskEditPanelSkeleton } from './task-edit-panel-skeleton';
import { TaskPanelModal } from './task-panel-modal';
import { useTerminology } from './terminology-provider';

type TaskEditPanelProps = TaskEditFormProps & {
  closeHref: string;
  isLoading?: boolean;
  onClose?: () => void;
  opened?: boolean;
  size?: string;
};

export function TaskEditPanel({
  closeHref,
  editableTodo,
  isLoading = false,
  onClose,
  opened = true,
  size = '80rem',
  ...formProps
}: TaskEditPanelProps) {
  if (isLoading) {
    return (
      <TaskPanelModal
        opened={opened}
        title="Edit Task"
        closeHref={closeHref}
        onClose={onClose}
        size={size}
      >
        <TaskEditPanelSkeleton />
      </TaskPanelModal>
    );
  }

  return (
    <LoadedTaskEditPanel
      closeHref={closeHref}
      editableTodo={editableTodo}
      onClose={onClose}
      opened={opened}
      size={size}
      {...formProps}
    />
  );
}

function LoadedTaskEditPanel({
  closeHref,
  editableTodo,
  onClose,
  opened = true,
  size = '80rem',
  ...formProps
}: TaskEditPanelProps) {
  const router = useRouter();
  const terminology = useTerminology();
  const controller = useTaskEditFormController({
    editableTodo,
    ...formProps,
  });
  useEffect(() => {
    if (!controller.updateState?.ok) {
      return;
    }

    void controller.clearOfflineDraft();
  }, [controller]);
  const dialogTitle = `Edit ${terminology.task.singular}`;
  const workflowStatus = editableTodo.status as keyof typeof TASK_STATUS_COLORS;

  return (
    <TaskPanelModal
      opened={opened}
      title={dialogTitle}
      titleContent={
        <TaskEditHeaderTitle
          key={controller.titleRenderKey ?? controller.fieldRenderKey}
          formId={controller.formId}
          placeholder={`Enter ${terminology.task.singularLower} title`}
          statusBadge={
            <Badge color={TASK_STATUS_COLORS[workflowStatus] ?? 'gray'} variant="filled" size="sm">
              {boardStatusLabel(workflowStatus, terminology)}
            </Badge>
          }
          title={controller.draftTitle}
          titleLabel={`${terminology.task.singular} title`}
          onBlur={controller.flushOnBlur}
          onChange={controller.markDirty}
          onTitleChange={(title) => {
            void controller.updateTitleDraft(title);
          }}
        />
      }
      headerCenterContent={<AutoSaveIndicator status={controller.saveStatus} justify="center" />}
      closeHref={closeHref}
      closeOnEscape
      onClose={onClose}
      size={size}
    >
      <TaskEditForm
        editableTodo={editableTodo}
        controller={controller}
        onDispatchQueued={() => router.replace(closeHref)}
        {...formProps}
      />
    </TaskPanelModal>
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
      size={size}
    >
      <EmptyState compact title={`${terminology.task.singular} not found`} />
    </TaskPanelModal>
  );
}
