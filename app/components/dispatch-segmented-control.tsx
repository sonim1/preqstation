'use client';

import { Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';

export type DispatchSegmentedControlOption<T extends string> = {
  value: T;
  selected: boolean;
  ariaLabel: string;
  content: ReactNode;
};

type DispatchSegmentedControlProps<T extends string> = {
  label: string;
  groupLabel: string;
  groupClassName?: string;
  options: DispatchSegmentedControlOption<T>[];
  disabled?: boolean;
  onSelect: (value: T) => void;
};

export function DispatchSegmentedControl<T extends string>({
  label,
  groupLabel,
  groupClassName,
  options,
  disabled = false,
  onSelect,
}: DispatchSegmentedControlProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.selected),
  );

  return (
    <div className="task-dispatch-field">
      <Text size="xs" fw={700} className="task-dispatch-field-label">
        {label}
      </Text>
      <div
        className={['task-dispatch-segmented-control', groupClassName].filter(Boolean).join(' ')}
        role="group"
        aria-label={groupLabel}
        data-option-count={options.length}
        data-selected-index={selectedIndex}
      >
        {options.map((option) => (
          <UnstyledButton
            key={option.value}
            type="button"
            className="task-dispatch-segment"
            data-selected={option.selected ? 'true' : undefined}
            aria-pressed={option.selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
          >
            {option.content}
          </UnstyledButton>
        ))}
      </div>
    </div>
  );
}
