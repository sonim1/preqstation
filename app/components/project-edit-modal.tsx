'use client';

import type { ComponentProps } from 'react';

import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import { TaskPanelModal } from '@/app/components/task-panel-modal';

export const PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY =
  'preqstation:project-edit-panel:fullscreen:v1';
export const PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY = 'preqstation:project-edit-panel:size:v1';

type ProjectEditModalProps = {
  opened?: boolean;
  closeHref: string;
  onClose?: ComponentProps<typeof TaskPanelModal>['onClose'];
  selectedProject: ComponentProps<typeof ProjectEditPanel>['selectedProject'];
  updateProjectAction: ComponentProps<typeof ProjectEditPanel>['updateProjectAction'];
  labelManagement?: ComponentProps<typeof ProjectEditPanel>['labelManagement'];
  createLabelAction?: ComponentProps<typeof ProjectEditPanel>['createLabelAction'];
  updateLabelAction?: ComponentProps<typeof ProjectEditPanel>['updateLabelAction'];
  deleteLabelAction?: ComponentProps<typeof ProjectEditPanel>['deleteLabelAction'];
  configurationManagement?: ComponentProps<typeof ProjectEditPanel>['configurationManagement'];
  updateAgentInstructionsAction?: ComponentProps<
    typeof ProjectEditPanel
  >['updateAgentInstructionsAction'];
  updateDeploySettingsAction?: ComponentProps<
    typeof ProjectEditPanel
  >['updateDeploySettingsAction'];
};

export function ProjectEditModal({
  opened = true,
  closeHref,
  onClose,
  selectedProject,
  updateProjectAction,
  labelManagement,
  createLabelAction,
  updateLabelAction,
  deleteLabelAction,
  configurationManagement,
  updateAgentInstructionsAction,
  updateDeploySettingsAction,
}: ProjectEditModalProps) {
  return (
    <TaskPanelModal
      opened={opened}
      title="Edit Project"
      closeHref={closeHref}
      onClose={onClose}
      size="58rem"
      fullscreenStorageKey={PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
      resizableStorageKey={PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY}
    >
      <ProjectEditPanel
        selectedProject={selectedProject}
        updateProjectAction={updateProjectAction}
        labelManagement={labelManagement}
        createLabelAction={createLabelAction}
        updateLabelAction={updateLabelAction}
        deleteLabelAction={deleteLabelAction}
        configurationManagement={configurationManagement}
        updateAgentInstructionsAction={updateAgentInstructionsAction}
        updateDeploySettingsAction={updateDeploySettingsAction}
      />
    </TaskPanelModal>
  );
}
