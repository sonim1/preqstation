import { Stack, Text } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';

import settingsClasses from '@/app/(workspace)/(main)/settings/settings-page.module.css';
import { ConfirmActionButton } from '@/app/components/confirm-action-button';
import { EmptyState } from '@/app/components/empty-state';
import controlClasses from '@/app/components/settings-controls.module.css';
import {
  SettingsLabelForm,
  SettingsLabelNameInput,
  TaskLabelColorField,
} from '@/app/components/settings-label-form';
import { SubmitButton } from '@/app/components/submit-button';
import { TODO_LABEL_NAME_MAX_LENGTH } from '@/lib/content-limits';
import { resolveTaskLabelSwatchColor } from '@/lib/task-meta';

type LabelActionState =
  | { ok: true }
  | { ok: false; message: string; field?: 'color' | 'form' | 'name' }
  | null;

type ProjectLabelsPanelProps = {
  labels: Array<{ id: string; name: string; color: string; usageCount: number }>;
  taskPluralLower: string;
  createLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  updateLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  deleteLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
};

function formatLabelUsageCopy(usageCount: number, taskPluralLower: string) {
  if (usageCount === 0) return 'Not used yet';
  const taskLabel = usageCount === 1 ? 'task' : taskPluralLower;
  return `Used by ${usageCount} ${taskLabel}`;
}

function formatDeleteConfirmMessage(usageCount: number, taskPluralLower: string) {
  if (usageCount === 0) return 'Deleting this label cannot be undone.';
  const taskLabel = usageCount === 1 ? 'task' : taskPluralLower;
  return `Deleting this label will remove it from ${usageCount} ${taskLabel}. This cannot be undone.`;
}

export function ProjectLabelsPanel({
  labels,
  taskPluralLower,
  createLabelAction,
  updateLabelAction,
  deleteLabelAction,
}: ProjectLabelsPanelProps) {
  const usedLabelColors = Array.from(new Set(labels.map((label) => label.color)));

  return (
    <Stack gap="md" data-layout="project-label-management">
      <div className={settingsClasses.labelCreate} data-panel="project-label-create">
        <div className={settingsClasses.labelSubhead}>
          <Text fw={600} className={settingsClasses.labelSubheadTitle}>
            Create label
          </Text>
          <Text className={settingsClasses.labelSectionDescription} size="sm">
            {`Add a reusable label for this project's ${taskPluralLower}.`}
          </Text>
        </div>

        <SettingsLabelForm action={createLabelAction}>
          <div className={settingsClasses.labelCreateForm} data-slot="project-label-create-form">
            <SettingsLabelNameInput
              name="name"
              aria-label="New project label name"
              placeholder="Improvement, Bug, Refactor..."
              required
              maxLength={TODO_LABEL_NAME_MAX_LENGTH}
              className={`${settingsClasses.labelNameInput} ${controlClasses.touchInput}`}
              size="sm"
            />
            <TaskLabelColorField
              defaultColor="blue"
              usedColors={usedLabelColors}
              label="New project label color"
              ariaLabel="New project label color"
              showLabel={false}
              size="sm"
            />
            <SubmitButton size="sm" className={controlClasses.touchButton}>
              Add label
            </SubmitButton>
          </div>
        </SettingsLabelForm>
      </div>

      <div className={settingsClasses.labelManage} data-panel="project-label-manage">
        <div className={settingsClasses.labelSubhead}>
          <Text fw={600} className={settingsClasses.labelSubheadTitle}>
            Manage labels
          </Text>
          <Text className={settingsClasses.labelSectionDescription} size="sm">
            Rename, recolor, or remove labels without leaving this project.
          </Text>
        </div>

        {labels.length === 0 ? (
          <EmptyState
            icon={<IconTag size={24} />}
            title="No labels yet"
            description={`Create your first project label above to categorize this project's ${taskPluralLower}.`}
          />
        ) : (
          <div className={settingsClasses.labelList}>
            {labels.map((label) => {
              const deleteFormId = `project-label-delete-${label.id}`;

              return (
                <article
                  key={label.id}
                  className={settingsClasses.labelRow}
                  data-label-row={label.id}
                >
                  <div className={settingsClasses.labelRowHeader}>
                    <span
                      className={settingsClasses.labelSwatch}
                      aria-hidden="true"
                      style={{ backgroundColor: resolveTaskLabelSwatchColor(label.color) }}
                    />
                    <Text fw={600}>{label.name}</Text>
                  </div>

                  <Text className={settingsClasses.labelRowMeta} size="sm">
                    {formatLabelUsageCopy(label.usageCount, taskPluralLower)}
                  </Text>

                  <SettingsLabelForm action={updateLabelAction}>
                    <div className={settingsClasses.labelRowEditor} data-slot="label-row-editor">
                      <input type="hidden" name="id" value={label.id} />
                      <SettingsLabelNameInput
                        name="name"
                        aria-label={`${label.name} label name`}
                        defaultValue={label.name}
                        required
                        maxLength={TODO_LABEL_NAME_MAX_LENGTH}
                        className={`${settingsClasses.labelNameInput} ${controlClasses.touchInput}`}
                        size="sm"
                      />
                      <TaskLabelColorField
                        defaultColor={label.color}
                        usedColors={usedLabelColors}
                        label={`${label.name} label color`}
                        ariaLabel={`${label.name} label color`}
                        showLabel={false}
                        size="sm"
                      />
                      <SubmitButton
                        variant="default"
                        size="sm"
                        className={controlClasses.touchButton}
                      >
                        Save
                      </SubmitButton>
                    </div>
                  </SettingsLabelForm>

                  <SettingsLabelForm action={deleteLabelAction} id={deleteFormId}>
                    <input type="hidden" name="id" value={label.id} />
                    <div className={settingsClasses.labelRowDanger} data-slot="label-row-danger">
                      <ConfirmActionButton
                        color="red"
                        variant="subtle"
                        size="sm"
                        formId={deleteFormId}
                        confirmTitle={`Delete ${label.name}?`}
                        confirmMessage={formatDeleteConfirmMessage(
                          label.usageCount,
                          taskPluralLower,
                        )}
                        confirmLabel="Delete label"
                        className={controlClasses.touchButton}
                      >
                        Delete
                      </ConfirmActionButton>
                    </div>
                  </SettingsLabelForm>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Stack>
  );
}
