'use client';

import { Menu } from '@mantine/core';
import { IconPointFilled } from '@tabler/icons-react';

import { PAUSED_PROJECT_STATUS } from '@/lib/project-meta';
import { isVisibleWorkspaceProject, type WorkspaceProjectOption } from '@/lib/workspace-project-picker';

export interface ProjectPickerMenuItemsProps {
  projectOptions: WorkspaceProjectOption[];
  selectedProjectId: string | null;
  onSelect: (projectKey: string) => void;
}

export function ProjectPickerMenuItems({
  projectOptions,
  selectedProjectId,
  onSelect,
}: ProjectPickerMenuItemsProps) {
  const visibleProjectOptions = projectOptions.filter(isVisibleWorkspaceProject);
  const pausedProjectOptions = projectOptions.filter(
    (project) => project.status === PAUSED_PROJECT_STATUS,
  );

  return (
    <>
      <Menu.Label>Boards</Menu.Label>
      {visibleProjectOptions.map((project) => {
        const isCurrentBoard = selectedProjectId === project.id;
        return (
          <Menu.Item
            key={project.id}
            onClick={() => onSelect(project.projectKey)}
            className="workspace-project-picker-item workspace-board-picker-item"
            data-current-board={isCurrentBoard ? 'true' : undefined}
            aria-current={isCurrentBoard ? 'page' : undefined}
            leftSection={
              <span className="workspace-board-current-indicator" aria-hidden="true">
                {isCurrentBoard ? <IconPointFilled size={10} /> : null}
              </span>
            }
          >
            {project.name}
          </Menu.Item>
        );
      })}
      {visibleProjectOptions.length > 0 && pausedProjectOptions.length > 0 ? <Menu.Divider /> : null}
      {pausedProjectOptions.length > 0 ? <Menu.Label>Paused</Menu.Label> : null}
      {pausedProjectOptions.map((project) => {
        const isCurrentBoard = selectedProjectId === project.id;
        return (
          <Menu.Item
            key={project.id}
            onClick={() => onSelect(project.projectKey)}
            className="workspace-project-picker-item workspace-board-picker-item"
            data-current-board={isCurrentBoard ? 'true' : undefined}
            aria-current={isCurrentBoard ? 'page' : undefined}
            leftSection={
              <span className="workspace-board-current-indicator" aria-hidden="true">
                {isCurrentBoard ? <IconPointFilled size={10} /> : null}
              </span>
            }
          >
            {project.name}
          </Menu.Item>
        );
      })}
    </>
  );
}
