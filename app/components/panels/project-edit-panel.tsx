'use client';

import { NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LiveMarkdownEditor } from '@/app/components/live-markdown-editor';
import { useOfflineStatus } from '@/app/components/offline-status-provider';
import { AgentInstructionsPanel } from '@/app/components/panels/agent-instructions-panel';
import { DeploySettingsPanel } from '@/app/components/panels/deploy-settings-panel';
import { ProjectLabelsPanel } from '@/app/components/panels/project-labels-panel';
import { ProjectBackgroundPicker } from '@/app/components/project-background-picker';
import { type SettingSaveState, SettingSaveStatus } from '@/app/components/setting-save-status';
import { useTerminology } from '@/app/components/terminology-provider';
import { useAutoSave } from '@/app/hooks/use-auto-save';
import { showErrorNotification } from '@/lib/notifications';
import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';
import { projectStatusOptionData } from '@/lib/project-meta';
import { getProjectEditTerminology } from '@/lib/terminology';

type ActionState = { ok: true } | { ok: false; message: string };
type LabelActionState =
  | { ok: true }
  | { ok: false; message: string; field?: 'color' | 'form' | 'name' }
  | null;
type SettingActionState = { ok: true; message?: string } | { ok: false; message: string } | null;

type SelectedProject = {
  id: string;
  name: string;
  projectKey: string;
  description: string | null;
  status: string;
  priority: number;
  bgImage: string | null;
  bgImageCredit: ProjectBackgroundCredit | null;
  repoUrl: string | null;
  vercelUrl: string | null;
};

type ProjectLabelManagement = {
  labels: Array<{ id: string; name: string; color: string; usageCount: number }>;
  taskSingularLower: string;
  taskPluralLower: string;
};

type ProjectConfigurationManagement = {
  projectId: string;
  projectName: string;
  agentInstructions: string | null;
  deployStrategy: {
    strategy: 'direct_commit' | 'feature_branch';
    default_branch: string;
    auto_pr: boolean;
    commit_on_review: boolean;
    squash_merge: boolean;
  };
};

type ProjectEditPanelProps = {
  selectedProject: SelectedProject | null | undefined;
  updateProjectAction: (prevState: unknown, formData: FormData) => Promise<ActionState>;
  labelManagement?: ProjectLabelManagement;
  createLabelAction?: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  updateLabelAction?: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  deleteLabelAction?: (prevState: unknown, formData: FormData) => Promise<LabelActionState>;
  configurationManagement?: ProjectConfigurationManagement;
  updateAgentInstructionsAction?: (
    prevState: unknown,
    formData: FormData,
  ) => Promise<SettingActionState>;
  updateDeploySettingsAction?: (
    prevState: unknown,
    formData: FormData,
  ) => Promise<SettingActionState>;
};

export function ProjectEditPanel({
  selectedProject,
  updateProjectAction,
  labelManagement,
  createLabelAction,
  updateLabelAction,
  deleteLabelAction,
  configurationManagement,
  updateAgentInstructionsAction,
  updateDeploySettingsAction,
}: ProjectEditPanelProps) {
  const terminology = useTerminology();
  const projectEditCopy = getProjectEditTerminology(terminology);
  const { online } = useOfflineStatus();
  const formRef = useRef<HTMLFormElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitProjectUpdate = useCallback(
    async (form: HTMLFormElement) => {
      if (!online) {
        const message = 'Project edits are available after reconnecting.';
        setSaveError(message);
        showErrorNotification(message);
        throw new Error(message);
      }

      const result = await updateProjectAction(null, new FormData(form));
      if (result.ok) {
        setSaveError(null);
        return;
      }

      setSaveError(result.message);
      showErrorNotification(result.message);
      throw new Error(result.message);
    },
    [online, updateProjectAction],
  );
  const {
    markDirty: baseMarkDirty,
    triggerSave: baseTriggerSave,
    syncSnapshot,
    status: saveStatus,
    isDirty,
  } = useAutoSave(formRef, 800, { submit: submitProjectUpdate });
  const selectedProjectRevision = selectedProject
    ? JSON.stringify({
        id: selectedProject.id,
        name: selectedProject.name,
        description: selectedProject.description ?? null,
        status: selectedProject.status,
        priority: selectedProject.priority,
        bgImage: selectedProject.bgImage ?? null,
        bgImageCredit: selectedProject.bgImageCredit ?? null,
      })
    : null;

  const markDirty = useCallback(() => {
    setSaveError(null);
    baseMarkDirty();
  }, [baseMarkDirty]);

  const triggerSave = useCallback(
    (delay?: number) => {
      setSaveError(null);
      baseTriggerSave(delay);
    },
    [baseTriggerSave],
  );

  const saveState: SettingSaveState = saveError
    ? 'error'
    : saveStatus === 'saving'
      ? 'saving'
      : isDirty
        ? 'dirty'
        : saveStatus === 'saved'
          ? 'saved'
          : 'idle';

  useEffect(() => {
    if (!selectedProjectRevision) return;

    const frame = requestAnimationFrame(() => {
      syncSnapshot();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selectedProjectRevision, syncSnapshot]);

  if (!selectedProject) {
    return <Text c="dimmed">Select a project to edit.</Text>;
  }

  const canManageLabels =
    labelManagement && createLabelAction && updateLabelAction && deleteLabelAction;
  const canManageConfiguration =
    configurationManagement && updateAgentInstructionsAction && updateDeploySettingsAction;

  return (
    <Stack gap="xl">
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Stack gap="md">
          <SettingSaveStatus mode="autosave" state={saveState} errorMessage={saveError} />
          <input type="hidden" name="projectId" value={selectedProject.id} />
          <TextInput
            name="name"
            label="Project name"
            placeholder="Enter project name"
            defaultValue={selectedProject.name}
            required
            onChange={markDirty}
            onBlur={() => triggerSave(0)}
          />
          <TextInput
            label="Project key"
            defaultValue={selectedProject.projectKey}
            description="Immutable after creation."
            disabled
          />
          <LiveMarkdownEditor
            name="descriptionMd"
            label="Project description (Markdown)"
            defaultValue={selectedProject.description || ''}
            placeholder="# Goal\n- Build MVP\n- Harden security"
            onContentChange={markDirty}
            onBlur={() => triggerSave(0)}
          />
          <NativeSelect
            name="status"
            label="Status"
            defaultValue={selectedProject.status}
            data={projectStatusOptionData()}
            onChange={() => triggerSave(0)}
          />
          <NativeSelect
            name="priority"
            label="Priority"
            defaultValue={String(selectedProject.priority)}
            data={[
              { value: '1', label: '1 - Lowest' },
              { value: '2', label: '2 - Low' },
              { value: '3', label: '3 - Medium' },
              { value: '4', label: '4 - High' },
              { value: '5', label: '5 - Highest' },
            ]}
            onChange={() => triggerSave(0)}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Background Image
            </Text>
            <ProjectBackgroundPicker
              key={`${selectedProject.id}:${selectedProject.bgImage || ''}:${selectedProject.bgImageCredit?.sourceUrl || ''}`}
              name="bgImage"
              value={selectedProject.bgImage}
              credit={selectedProject.bgImageCredit}
              onValueChange={() => {
                triggerSave(0);
              }}
            />
          </div>
          <TextInput
            name="repoUrl"
            label="GitHub repo URL"
            placeholder="https://github.com/you/repo"
            defaultValue={selectedProject.repoUrl || ''}
            onChange={markDirty}
            onBlur={() => triggerSave(0)}
          />
          <TextInput
            name="vercelUrl"
            label="Vercel project URL"
            placeholder="https://your-project.vercel.app"
            defaultValue={selectedProject.vercelUrl || ''}
            onChange={markDirty}
            onBlur={() => triggerSave(0)}
          />
        </Stack>
      </form>

      {canManageLabels ? (
        <Stack gap="md" data-project-edit-label-management="true">
          <div>
            <Title order={4}>{projectEditCopy.labelsTitle}</Title>
            <Text c="dimmed" size="sm">
              {projectEditCopy.labelsDescription}
            </Text>
          </div>
          <ProjectLabelsPanel
            labels={labelManagement.labels}
            taskSingularLower={labelManagement.taskSingularLower}
            taskPluralLower={labelManagement.taskPluralLower}
            createLabelAction={createLabelAction}
            updateLabelAction={updateLabelAction}
            deleteLabelAction={deleteLabelAction}
          />
        </Stack>
      ) : null}

      {canManageConfiguration ? (
        <Stack gap="xl" data-project-edit-configuration-management="true">
          <Stack gap="md">
            <div>
              <Title order={4}>Agent Instructions</Title>
              <Text c="dimmed" size="sm">
                Save project guidance that dispatched PREQ agents inherit.
              </Text>
            </div>
            <AgentInstructionsPanel
              action={updateAgentInstructionsAction}
              projectId={configurationManagement.projectId}
              value={configurationManagement.agentInstructions}
            />
          </Stack>

          <Stack gap="md">
            <div>
              <Title order={4}>Deployment Strategy</Title>
              <Text c="dimmed" size="sm">
                Configure how dispatched work gets pushed, reviewed, and merged.
              </Text>
            </div>
            <DeploySettingsPanel
              action={updateDeploySettingsAction}
              singleProject
              defaultProjectId={configurationManagement.projectId}
              projects={[
                {
                  id: configurationManagement.projectId,
                  name: configurationManagement.projectName,
                  deployStrategy: configurationManagement.deployStrategy,
                },
              ]}
            />
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
