'use client';

import { NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import { useActionState, useEffect, useState } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { SubmitButton } from '@/app/components/submit-button';
import { TaskLabelPicker } from '@/app/components/task-label-picker';
import { TaskMetadataPriorityPicker } from '@/app/components/task-metadata-controls';
import { showErrorNotification } from '@/lib/notifications';

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
        <section className={classes.setupSection} data-panel="task-form-setup">
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
          <section className={classes.notesSection} data-panel="task-form-notes">
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

          <section className={classes.metaSection} data-panel="task-form-metadata">
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
              <TaskMetadataPriorityPicker
                resetKey={taskFormSuccessResetKey(state)}
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
