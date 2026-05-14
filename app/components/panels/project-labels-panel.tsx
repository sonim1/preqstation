import { Stack, Text, Title } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';

import settingsClasses from '@/app/(workspace)/(main)/settings/settings-page.module.css';
import { EmptyState } from '@/app/components/empty-state';
import { ProjectLabelTile } from '@/app/components/panels/project-label-tile';
import controlClasses from '@/app/components/settings-controls.module.css';
import {
  SettingsLabelForm,
  SettingsLabelNameInput,
  TaskLabelColorField,
} from '@/app/components/settings-label-form';
import { SubmitButton } from '@/app/components/submit-button';
import { TODO_LABEL_NAME_MAX_LENGTH } from '@/lib/content-limits';

type LabelActionState =
  | { ok: true }
  | { ok: false; message: string; field?: 'color' | 'form' | 'name' }
  | null;

type ProjectLabelsPanelProps = {
  labels: Array<{ id: string; name: string; color: string; usageCount: number }>;
  taskSingularLower: string;
  taskPluralLower: string;
  createLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  updateLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  deleteLabelAction: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
};

function formatLabelUsageCopy(
  usageCount: number,
  taskSingularLower: string,
  taskPluralLower: string,
) {
  if (usageCount === 0) return 'Not used yet';
  const taskLabel = usageCount === 1 ? taskSingularLower : taskPluralLower;
  return `Used by ${usageCount} ${taskLabel}`;
}

function formatDeleteConfirmMessage(
  usageCount: number,
  taskSingularLower: string,
  taskPluralLower: string,
) {
  if (usageCount === 0) return 'Deleting this label cannot be undone.';
  const taskLabel = usageCount === 1 ? taskSingularLower : taskPluralLower;
  return `Deleting this label will remove it from ${usageCount} ${taskLabel}. This cannot be undone.`;
}

export function ProjectLabelsPanel({
  labels,
  taskSingularLower,
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
          <Title order={5} className={settingsClasses.labelSubheadTitle}>
            Create label
          </Title>
          <Text className={settingsClasses.labelSectionDescription} size="sm">
            {`Add a reusable label for this project's ${taskPluralLower}.`}
          </Text>
        </div>

        <SettingsLabelForm action={createLabelAction}>
          <div className={settingsClasses.labelCreateForm} data-slot="project-label-create-form">
            <SettingsLabelNameInput
              label="Name"
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
              label="Color"
              ariaLabel="New project label color"
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
          <Title order={5} className={settingsClasses.labelSubheadTitle}>
            Manage labels
          </Title>
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
            {labels.map((label) => (
              <ProjectLabelTile
                key={`${label.id}:${label.name}:${label.color}`}
                label={label}
                usageCopy={formatLabelUsageCopy(
                  label.usageCount,
                  taskSingularLower,
                  taskPluralLower,
                )}
                deleteConfirmMessage={formatDeleteConfirmMessage(
                  label.usageCount,
                  taskSingularLower,
                  taskPluralLower,
                )}
                updateLabelAction={updateLabelAction}
                deleteLabelAction={deleteLabelAction}
              />
            ))}
          </div>
        )}
      </div>
    </Stack>
  );
}
