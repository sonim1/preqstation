import type { ComponentProps } from 'react';

import { ProjectEditPanel } from '@/app/components/panels/project-edit-panel';
import { TaskPanelModal } from '@/app/components/task-panel-modal';

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
    <TaskPanelModal opened={opened} title="Edit Project" closeHref={closeHref} size="58rem">
      <ProjectEditPanel
        selectedProject={selectedProject}
        updateProjectAction={updateProjectAction}
      />
    </TaskPanelModal>
  );
}
