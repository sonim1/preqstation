import type { ComponentProps } from 'react';

import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import { TaskPanelModal } from '@/app/components/task-panel-modal';

export const PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY =
  'preqstation:project-edit-panel:fullscreen:v1';
export const PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY = 'preqstation:project-edit-panel:size:v1';

type ProjectEditModalProps = {
  opened?: boolean;
  closeHref: string;
  selectedProject: ComponentProps<typeof ProjectEditPanel>['selectedProject'];
  updateProjectAction: ComponentProps<typeof ProjectEditPanel>['updateProjectAction'];
};

export function ProjectEditModal({
  opened = true,
  closeHref,
  selectedProject,
  updateProjectAction,
}: ProjectEditModalProps) {
  return (
    <TaskPanelModal
      opened={opened}
      title="Edit Project"
      closeHref={closeHref}
      size="58rem"
      fullscreenStorageKey={PROJECT_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}
      resizableStorageKey={PROJECT_EDIT_PANEL_RESIZE_STORAGE_KEY}
    >
      <ProjectEditPanel
        selectedProject={selectedProject}
        updateProjectAction={updateProjectAction}
      />
    </TaskPanelModal>
  );
}
