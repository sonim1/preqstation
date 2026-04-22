import {
  IconChevronDown,
  IconChevronsDown,
  IconChevronsUp,
  IconChevronUp,
  IconMinus,
} from '@tabler/icons-react';

import type { TaskPriority } from '@/lib/task-meta';
import { parseTaskPriority, TASK_PRIORITY_COLOR, TASK_PRIORITY_LABEL } from '@/lib/task-meta';

const PRIORITY_ICONS: Record<TaskPriority, React.ElementType | null> = {
  highest: IconChevronsUp,
  high: IconChevronUp,
  medium: IconMinus,
  none: null,
  low: IconChevronDown,
  lowest: IconChevronsDown,
};

type TaskPriorityIconProps = {
  priority: string;
  size?: number;
};

export function TaskPriorityIcon({ priority, size = 12 }: TaskPriorityIconProps) {
  const parsed = parseTaskPriority(priority);
  const Icon = PRIORITY_ICONS[parsed];
  const color = TASK_PRIORITY_COLOR[parsed];

  if (!Icon || !color) return null;

  return <Icon size={size} color={color} aria-label={TASK_PRIORITY_LABEL[parsed]} />;
}
