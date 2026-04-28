// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const popoverPropsMock = vi.hoisted(() => vi.fn());
const stackPropsMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', () => {
  const PopoverRoot = ({
    children,
    withinPortal,
  }: {
    children: React.ReactNode;
    withinPortal?: boolean;
  }) => {
    popoverPropsMock({ withinPortal });
    return <div>{children}</div>;
  };

  const Popover = Object.assign(PopoverRoot, {
    Target: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  });

  return {
    Button: ({
      children,
      disabled,
      leftSection,
      onClick,
      rightSection,
      type = 'button',
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      leftSection?: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      rightSection?: React.ReactNode;
      type?: 'button' | 'submit' | 'reset';
    }) => (
      <button disabled={disabled} onClick={onClick} type={type}>
        {leftSection}
        {children}
        {rightSection}
      </button>
    ),
    ColorSwatch: ({ color }: { color: string }) => <span data-color={color} />,
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Popover,
    Stack: ({
      children,
      gap,
      mah,
      miw,
      style,
    }: {
      children: React.ReactNode;
      gap?: number | string;
      mah?: number;
      miw?: number;
      style?: React.CSSProperties;
    }) => {
      stackPropsMock({ gap, mah, miw, style });
      return <div>{children}</div>;
    },
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    TextInput: ({
      ariaLabel,
      onChange,
      placeholder,
      value,
    }: {
      ariaLabel?: string;
      onChange?: React.ChangeEventHandler<HTMLInputElement>;
      placeholder?: string;
      value?: string;
    }) => (
      <input aria-label={ariaLabel} onChange={onChange} placeholder={placeholder} value={value} />
    ),
    UnstyledButton: ({
      ariaLabel,
      children,
      disabled,
      onClick,
      onPointerDown,
      type = 'button',
    }: {
      ariaLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
      type?: 'button' | 'submit' | 'reset';
    }) => (
      <button
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
        type={type}
      >
        {children}
      </button>
    ),
  };
});

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => ({ checkedAt: null, online: true }),
}));

vi.mock('@/app/components/settings-label-form', () => ({
  TaskLabelColorPicker: () => <div>Color picker</div>,
}));

vi.mock('@/lib/project-label-client', () => ({
  createProjectLabelWithRecovery: vi.fn(),
  sortProjectLabelOptions: (labelOptions: Array<unknown>) => labelOptions,
  upsertProjectLabelOptions: (labelOptions: Array<unknown>) => labelOptions,
}));

vi.mock('@/lib/task-meta', () => ({
  resolveTaskLabelSwatchColor: (color: string | null | undefined) => color ?? 'gray',
}));

import { TaskLabelPicker } from '@/app/components/task-label-picker';

const labelOptions = [
  { id: 'label-1', name: 'Bug', color: 'red' },
  { id: 'label-2', name: 'Ops', color: 'green' },
];

describe('app/components/task-label-picker UI behavior', () => {
  beforeEach(() => {
    popoverPropsMock.mockReset();
    stackPropsMock.mockReset();
  });

  it('renders the dropdown in a portal, constrains the label list, and disables label actions', () => {
    render(
      <TaskLabelPicker
        disabled
        labelOptions={labelOptions}
        onChange={vi.fn()}
        projectId="project-1"
        selectedLabelIds={[]}
        triggerAriaLabel="Edit labels"
      />,
    );

    expect(popoverPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        withinPortal: true,
      }),
    );
    expect(stackPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gap: 4,
        mah: 300,
        style: { overflowY: 'auto' },
      }),
    );
    expect((screen.getByRole('button', { name: 'Bug' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Ops' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
