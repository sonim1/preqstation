'use client';

import { Menu, NativeSelect, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useActionState, useEffect, useMemo, useState } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { SubmitButton } from '@/app/components/submit-button';
import { TaskLabelPicker } from '@/app/components/task-label-picker';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { showErrorNotification } from '@/lib/notifications';
import { parseTaskPriority, TASK_PRIORITY_LABEL, type TaskPriority } from '@/lib/task-meta';

import { useTerminology } from '../terminology-provider';
import classes from './task-form-panel.module.css';

type ActionState = { ok: true } | { ok: false; message: string } | null;

const successResetKeys = new WeakMap<object, number>();
let nextSuccessResetKey = 0;

type TaskFormPanelProps = {
  createTodoAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  projects: Array<{ id: string; name: string }>;
  projectLabelsByProjectId?: Record<
    string,
    Array<{ id: string; name: string; color: string | null }>
  >;
  taskPriorityOptions: Array<{ value: string; label: string }>;
  defaultProjectId?: string;
};

function taskFormSuccessResetKey(state: ActionState) {
  if (!state?.ok) {
    return 0;
  }

  const existingKey = successResetKeys.get(state);

  if (existingKey) {
    return existingKey;
  }

  nextSuccessResetKey += 1;
  successResetKeys.set(state, nextSuccessResetKey);

  return nextSuccessResetKey;
}

const TASK_PRIORITY_DETAIL: Record<TaskPriority, string> = {
  highest: 'Escalated, unblock first',
  high: 'Important, visible on card',
  medium: 'Useful, not urgent',
  none: 'No marker on card',
  low: 'Defer if needed',
  lowest: 'Parking lot',
};

function TaskFormPriorityMark({ priority }: { priority: TaskPriority }) {
  if (priority === 'none') {
    return <span className={classes.priorityNoneDot} aria-hidden="true" />;
  }

  return <TaskPriorityIcon priority={priority} size={14} />;
}

function TaskFormPriorityPicker({
  priorityOptions,
  label,
}: {
  priorityOptions: Array<{ value: string; label: string }>;
  label: string;
}) {
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('none');
  const [opened, setOpened] = useState(false);
  const menuPriorities = useMemo(() => {
    return priorityOptions.length > 0
      ? Array.from(new Set(priorityOptions.map((option) => parseTaskPriority(option.value))))
      : (['none'] as TaskPriority[]);
  }, [priorityOptions]);
  const selectedLabel = TASK_PRIORITY_LABEL[selectedPriority];

  return (
    <div className={classes.priorityField}>
      <Text component="div" size="sm" fw={500} className={classes.priorityLabel}>
        {label}
      </Text>
      <input type="hidden" name="taskPriority" value={selectedPriority} />
      <Menu opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
        <Menu.Target>
          <UnstyledButton
            type="button"
            className={classes.priorityTrigger}
            aria-label={label}
            data-opened={opened ? 'true' : undefined}
            data-task-priority-value={selectedPriority}
          >
            <span className={classes.priorityTriggerLabel}>
              <TaskFormPriorityMark priority={selectedPriority} />
              <span>{selectedLabel}</span>
            </span>
            <span className={classes.priorityTriggerMeta}>
              <span className={classes.priorityTriggerHint}>Priority</span>
              <IconChevronDown size={14} aria-hidden="true" />
            </span>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown className={classes.priorityDropdown}>
          <div role="group" aria-label={label}>
            {menuPriorities.map((priority) => {
              const isSelected = priority === selectedPriority;

              return (
                <Menu.Item
                  key={priority}
                  role="menuitemradio"
                  aria-checked={isSelected}
                  aria-label={TASK_PRIORITY_LABEL[priority]}
                  data-task-priority-option="true"
                  data-task-priority-value={priority}
                  leftSection={
                    <span className={classes.priorityOptionIcon}>
                      <TaskFormPriorityMark priority={priority} />
                    </span>
                  }
                  rightSection={isSelected ? <IconCheck size={14} /> : null}
                  onClick={() => setSelectedPriority(priority)}
                >
                  <span className={classes.priorityOptionText}>
                    <span className={classes.priorityOptionLabel}>
                      {TASK_PRIORITY_LABEL[priority]}
                    </span>
                    <span className={classes.priorityOptionDetail}>
                      {TASK_PRIORITY_DETAIL[priority]}
                    </span>
                  </span>
                </Menu.Item>
              );
            })}
          </div>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

export function TaskFormPanel({
  createTodoAction,
  projects,
  projectLabelsByProjectId = {},
  taskPriorityOptions,
  defaultProjectId,
}: TaskFormPanelProps) {
  const terminology = useTerminology();
  const [state, formAction] = useActionState(createTodoAction, null);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const availableLabels = projectId ? (projectLabelsByProjectId[projectId] ?? []) : [];
  const selectedLabels = availableLabels.filter((label) => selectedLabelIds.includes(label.id));

  useEffect(() => {
    if (state && !state.ok) {
      showErrorNotification(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      {selectedLabelIds.map((selectedLabelId) => (
        <input key={selectedLabelId} type="hidden" name="labelIds" value={selectedLabelId} />
      ))}

      <div className={classes.workbench} data-layout="task-form-workbench">
        <section className={classes.setupCard} data-panel="task-form-setup">
          <Stack gap="md">
            <div className={classes.sectionHeader}>
              <Text component="h2" fw={700} size="sm" className={classes.sectionTitle}>
                {`${terminology.task.singular} setup`}
              </Text>
              <Text size="xs" c="dimmed" className={classes.sectionDescription}>
                {`Start with the ${terminology.task.singularLower} identity, then fill in the notes and supporting metadata.`}
              </Text>
            </div>

            <div className={classes.setupGrid}>
              <TextInput
                name="title"
                label={`${terminology.task.singular} title`}
                placeholder={`Enter ${terminology.task.singularLower} title`}
                required
              />
              <NativeSelect
                name="projectId"
                label="Project"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.currentTarget.value);
                  setSelectedLabelIds([]);
                }}
                required
                data={[
                  { value: '', label: 'Select a project' },
                  ...projects.map((project) => ({ value: project.id, label: project.name })),
                ]}
              />
            </div>
          </Stack>
        </section>

        <div className={classes.columns}>
          <section className={classes.notesCard} data-panel="task-form-notes">
            <Stack gap="md">
              <div className={classes.sectionHeader}>
                <Text component="h2" fw={700} size="sm" className={classes.sectionTitle}>
                  Notes
                </Text>
                <Text size="xs" c="dimmed" className={classes.sectionDescription}>
                  Keep the Markdown brief visible while you shape the task details.
                </Text>
              </div>

              <LiveMarkdownEditor
                name="contentMd"
                label={`${terminology.task.singular} content (Markdown)`}
                placeholder="## Context\nDescribe details here..."
              />
            </Stack>
          </section>

          <section className={classes.metaCard} data-panel="task-form-metadata">
            <Stack gap="md">
              <div className={classes.sectionHeader}>
                <Text component="h2" fw={700} size="sm" className={classes.sectionTitle}>
                  {`${terminology.task.singular} metadata`}
                </Text>
                <Text size="xs" c="dimmed" className={classes.sectionDescription}>
                  Group labels and priority together without adding any new workflow fields.
                </Text>
              </div>

              <TaskLabelPicker
                labelOptions={availableLabels}
                selectedLabelIds={selectedLabelIds}
                selectedLabels={selectedLabels}
                projectId={projectId}
                triggerAriaLabel="Labels"
                triggerLabel="Labels"
                emptyStateLabel={projectId ? 'Select labels' : 'Select a project first'}
                searchPlaceholder="Search labels"
                disabled={!projectId}
                onChange={setSelectedLabelIds}
              />
              <TaskFormPriorityPicker
                key={taskFormSuccessResetKey(state)}
                priorityOptions={taskPriorityOptions}
                label={`${terminology.task.singular} priority`}
              />
              <div className={classes.actions}>
                <SubmitButton>{`Create ${terminology.task.singular}`}</SubmitButton>
              </div>
            </Stack>
          </section>
        </div>
      </div>
    </form>
  );
}
