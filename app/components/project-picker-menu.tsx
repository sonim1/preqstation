'use client';

import { Menu } from '@mantine/core';
import { IconPointFilled } from '@tabler/icons-react';

export interface ProjectPickerMenuItemsProps {
  projectOptions: Array<{ id: string; name: string; projectKey: string }>;
  hasSelectedProject: boolean;
  selectedProjectId: string | null;
  onSelect: (projectKey: string | null) => void;
}

export function ProjectPickerMenuItems({
  projectOptions,
  hasSelectedProject,
  selectedProjectId,
  onSelect,
}: ProjectPickerMenuItemsProps) {
  return (
    <>
      <Menu.Label>Boards</Menu.Label>
      <Menu.Item
        onClick={() => onSelect(null)}
        className="workspace-project-picker-item workspace-board-picker-item"
        data-current-board={!hasSelectedProject ? 'true' : undefined}
        aria-current={!hasSelectedProject ? 'page' : undefined}
        leftSection={
          <span className="workspace-board-current-indicator" aria-hidden="true">
            {!hasSelectedProject ? <IconPointFilled size={10} /> : null}
          </span>
        }
      >
        All Projects
      </Menu.Item>
      {projectOptions.length > 0 ? <Menu.Divider /> : null}
      {projectOptions.map((project) => {
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
