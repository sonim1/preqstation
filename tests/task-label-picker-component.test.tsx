// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const popoverPropsMock = vi.hoisted(() => vi.fn());
const stackPropsMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', () => {
  const PopoverContext = React.createContext({ opened: false });

  const PopoverRoot = ({
    children,
    opened = false,
    withinPortal,
  }: {
    children: React.ReactNode;
    opened?: boolean;
    withinPortal?: boolean;
  }) => {
    popoverPropsMock({ opened, withinPortal });
    return <PopoverContext.Provider value={{ opened }}>{children}</PopoverContext.Provider>;
  };

  const Popover = Object.assign(PopoverRoot, {
    Target: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dropdown: ({ children }: { children: React.ReactNode }) => {
      const { opened } = React.useContext(PopoverContext);
      return opened ? <div>{children}</div> : null;
    },
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
      'aria-label': ariaLabel,
      onChange,
      onKeyDown,
      placeholder,
      value,
    }: {
      'aria-label'?: string;
      onChange?: React.ChangeEventHandler<HTMLInputElement>;
      onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
      placeholder?: string;
      value?: string;
    }) => (
      <input
        aria-label={ariaLabel}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        value={value}
      />
    ),
    UnstyledButton: ({
      'aria-label': ariaLabel,
      children,
      disabled,
      onClick,
      onPointerDown,
      type = 'button',
    }: {
      'aria-label'?: string;
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
import { createProjectLabelWithRecovery } from '@/lib/project-label-client';

const labelOptions = [
  { id: 'label-1', name: 'Bug', color: 'red' },
  { id: 'label-2', name: 'Ops', color: 'green' },
];

describe('app/components/task-label-picker UI behavior', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    popoverPropsMock.mockReset();
    stackPropsMock.mockReset();
    vi.mocked(createProjectLabelWithRecovery).mockReset();
  });

  it('renders the dropdown in a portal and constrains the label list', () => {
    render(
      <TaskLabelPicker
        labelOptions={labelOptions}
        onChange={vi.fn()}
        projectId="project-1"
        selectedLabelIds={[]}
        triggerAriaLabel="Edit labels"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));

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
    expect(screen.getByRole('button', { name: 'Bug' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ops' })).toBeTruthy();
  });

  it('opens the dropdown when the trigger is clicked, even when the caller stops propagation', () => {
    const onTriggerClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    });

    render(
      <TaskLabelPicker
        labelOptions={labelOptions}
        onChange={vi.fn()}
        onTriggerClick={onTriggerClick}
        projectId="project-1"
        selectedLabelIds={[]}
        triggerAriaLabel="Edit labels"
      />,
    );

    expect(screen.queryByPlaceholderText('Search labels')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Search labels')).toBeTruthy();
  });

  it('creates a new label when Enter is pressed in the search input', async () => {
    const onChange = vi.fn();

    vi.mocked(createProjectLabelWithRecovery).mockResolvedValue({
      label: { id: 'label-3', name: 'Platform', color: 'blue' },
    });

    render(
      <TaskLabelPicker
        labelOptions={labelOptions}
        onChange={onChange}
        projectId="project-1"
        selectedLabelIds={[]}
        triggerAriaLabel="Edit labels"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));

    const searchInput = screen.getByPlaceholderText('Search labels');

    fireEvent.change(searchInput, { target: { value: 'Platform' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    await waitFor(() => {
      expect(createProjectLabelWithRecovery).toHaveBeenCalledWith({
        color: 'blue',
        name: 'Platform',
        projectId: 'project-1',
      });
    });
    expect(onChange).toHaveBeenCalledWith(['label-3']);
  });
});
