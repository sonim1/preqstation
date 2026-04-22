'use client';

import { Tooltip } from '@mantine/core';

import { PROJECT_ACTIVITY_STATUS_META, type ProjectActivityStatus } from '@/lib/project-activity';

interface ProjectHealthDotProps {
  health: ProjectActivityStatus;
}

export function ProjectHealthDot({ health }: ProjectHealthDotProps) {
  const { color, label } = PROJECT_ACTIVITY_STATUS_META[health];
  return (
    <Tooltip label={label} withArrow>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
          cursor: 'default',
        }}
        aria-label={label}
      />
    </Tooltip>
  );
}
