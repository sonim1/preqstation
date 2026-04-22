'use client';

import { MultiSelect, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import { useActionState, useEffect, useState } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { SubmitButton } from '@/app/components/submit-button';
import { showErrorNotification } from '@/lib/notifications';

import { useTerminology } from '../terminology-provider';
import classes from './task-form-panel.module.css';

type ActionState = { ok: true } | { ok: false; message: string } | null;

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

              <MultiSelect
                label="Labels"
                placeholder={projectId ? 'Select labels' : 'Select a project first'}
                value={selectedLabelIds}
                onChange={setSelectedLabelIds}
                data={availableLabels.map((label) => ({ value: label.id, label: label.name }))}
                searchable
                clearable
                disabled={!projectId}
              />
              <NativeSelect
                name="taskPriority"
                label={`${terminology.task.singular} priority`}
                defaultValue="none"
                data={taskPriorityOptions}
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
