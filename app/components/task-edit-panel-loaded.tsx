'use client';

import { Badge } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AutoSaveIndicator } from '@/app/components/auto-save-indicator';
import { boardStatusLabel } from '@/lib/kanban-helpers';
import { TASK_STATUS_COLORS } from '@/lib/task-meta';

import { TaskEditForm, useTaskEditFormController } from './task-edit-form';
import { TaskEditHeaderTitle } from './task-edit-header-title';
import {
  TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY,
  TASK_EDIT_PANEL_RESIZE_STORAGE_KEY,
} from './task-edit-panel-storage';
import type { TaskEditPanelProps } from './task-edit-panel-types';
import { TaskPanelModal } from './task-panel-modal';
import { useTerminology } from './terminology-provider';

export {
  TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY,
  TASK_EDIT_PANEL_RESIZE_STORAGE_KEY,
} from './task-edit-panel-storage';

export function LoadedTaskEditPanel({
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
  const { clearOfflineDraft, updateState } = controller;
  const isUpdateOk = updateState?.ok === true;

  useEffect(() => {
    if (!isUpdateOk) {
      return;
    }

    void clearOfflineDraft();
  }, [clearOfflineDraft, isUpdateOk]);
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
      fullscreenStorageKey={TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
      resizableStorageKey={TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}
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
