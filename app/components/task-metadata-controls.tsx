'use client';

import { Menu, Text, UnstyledButton } from '@mantine/core';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import { parseTaskPriority, TASK_PRIORITY_LABEL, type TaskPriority } from '@/lib/task-meta';

import classes from './task-metadata-controls.module.css';

const TASK_PRIORITY_DETAIL: Record<TaskPriority, string> = {
  highest: 'Escalated, unblock first',
  high: 'Important, visible on card',
  medium: 'Useful, not urgent',
  none: 'No marker on card',
  low: 'Defer if needed',
  lowest: 'Parking lot',
};

export function TaskPriorityMark({ priority }: { priority: TaskPriority }) {
  if (priority === 'none') {
    return <span className={classes.priorityNoneDot} aria-hidden="true" />;
  }

  return <TaskPriorityIcon priority={priority} size={14} />;
}

type TaskMetadataPriorityPickerProps = {
  initialPriority?: string;
  priorityOptions: Array<{ value: string; label: string }>;
  label: string;
  name?: string;
  resetKey?: string | number;
  disabled?: boolean;
  onChange?: (priority: TaskPriority) => void;
};

export function TaskMetadataPriorityPicker({
  resetKey,
  ...props
}: TaskMetadataPriorityPickerProps) {
  return (
    <TaskMetadataPriorityPickerInner
      key={`${props.initialPriority ?? 'none'}:${resetKey ?? ''}`}
      {...props}
    />
  );
}

function TaskMetadataPriorityPickerInner({
  initialPriority = 'none',
  priorityOptions,
  label,
  name = 'taskPriority',
  disabled = false,
  onChange,
}: Omit<TaskMetadataPriorityPickerProps, 'resetKey'>) {
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>(() =>
    parseTaskPriority(initialPriority),
  );
  const [opened, setOpened] = useState(false);
  const menuPriorities = useMemo(() => {
    return priorityOptions.length > 0
      ? Array.from(new Set(priorityOptions.map((option) => parseTaskPriority(option.value))))
      : [parseTaskPriority(initialPriority)];
  }, [initialPriority, priorityOptions]);
  const selectedLabel = TASK_PRIORITY_LABEL[selectedPriority];

  const selectPriority = (priority: TaskPriority) => {
    if (disabled) {
      return;
    }

    setSelectedPriority(priority);
    onChange?.(priority);
  };

  return (
    <div className={classes.priorityField}>
      <Text component="div" size="sm" fw={500} className={classes.priorityLabel}>
        {label}
      </Text>
      <input type="hidden" name={name} value={selectedPriority} />
      <Menu opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
        <Menu.Target>
          <UnstyledButton
            type="button"
            className={classes.priorityTrigger}
            aria-label={label}
            disabled={disabled}
            data-opened={opened ? 'true' : undefined}
            data-task-priority-value={selectedPriority}
          >
            <span className={classes.priorityTriggerLabel}>
              <TaskPriorityMark priority={selectedPriority} />
              <span>{selectedLabel}</span>
            </span>
            <span className={classes.priorityTriggerMeta}>
              <span className={classes.priorityTriggerHint}>Priority</span>
              <IconChevronDown size={14} aria-hidden="true" />
            </span>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown className={classes.priorityDropdown}>
          <div role="group" aria-label={label}>
            {menuPriorities.map((priority) => {
              const isSelected = priority === selectedPriority;

              return (
                <Menu.Item
                  key={priority}
                  role="menuitemradio"
                  aria-checked={isSelected}
                  aria-label={TASK_PRIORITY_LABEL[priority]}
                  data-task-priority-option="true"
                  data-task-priority-value={priority}
                  leftSection={
                    <span className={classes.priorityOptionIcon}>
                      <TaskPriorityMark priority={priority} />
                    </span>
                  }
                  rightSection={isSelected ? <IconCheck size={14} /> : null}
                  onClick={() => selectPriority(priority)}
                  disabled={disabled}
                >
                  <span className={classes.priorityOptionText}>
                    <span className={classes.priorityOptionLabel}>
                      {TASK_PRIORITY_LABEL[priority]}
                    </span>
                    <span className={classes.priorityOptionDetail}>
                      {TASK_PRIORITY_DETAIL[priority]}
                    </span>
                  </span>
                </Menu.Item>
              );
            })}
          </div>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
