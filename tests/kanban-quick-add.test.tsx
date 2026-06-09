// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boardOfflineSyncMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());
const taskPriorityPickerPropsMock = vi.hoisted(() => vi.fn());
const useOfflineStatusMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/components/board-offline-sync-provider', () => ({
  useBoardOfflineSync: () => boardOfflineSyncMock(),
}));

vi.mock('@/app/components/offline-status-provider', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}));

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    type = 'button',
    loading: _loading,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
  }) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  NativeSelect: ({
    data,
    value,
    onChange: _onChange,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    data: Array<{ value: string; label: string }>;
  }) => (
    <select defaultValue={value} {...props}>
      {data.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TextInput: ({
    value,
    placeholder,
    onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} placeholder={placeholder} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/app/components/task-label-picker', () => ({
  TaskLabelPicker: (props: Record<string, unknown>) => {
    taskLabelPickerPropsMock(props);
    return <div data-component="TaskLabelPicker" />;
  },
}));

vi.mock('@/app/components/task-metadata-controls', () => ({
  TaskMetadataPriorityPicker: (props: Record<string, unknown>) => {
    taskPriorityPickerPropsMock(props);
    return <button type="button" aria-label={`${props.label}: No priority`} />;
  },
}));

import { KanbanQuickAdd } from '@/app/components/kanban-quick-add';

function renderQuickAdd(selectedProject: { id: string; name: string } | null) {
  return renderToStaticMarkup(
    <KanbanQuickAdd
      selectedProject={selectedProject}
      projectOptions={[{ id: 'project-1', name: 'Alpha' }]}
      projectLabelOptionsByProjectId={{
        'project-1': [{ id: 'label-1', name: 'Bug', color: 'red' }],
      }}
      editHrefBase="/board"
      editHrefJoiner="?"
      onClose={vi.fn()}
    />,
  );
}

describe('app/components/kanban-quick-add accessibility', () => {
  beforeEach(() => {
    boardOfflineSyncMock.mockReset();
    routerPushMock.mockReset();
    taskLabelPickerPropsMock.mockReset();
    taskPriorityPickerPropsMock.mockReset();
    useOfflineStatusMock.mockReset();
    useOfflineStatusMock.mockReturnValue({ online: true });
    boardOfflineSyncMock.mockReturnValue(null);
  });

  it('renders accessible names for all interactive fields on all-project boards', () => {
    const html = renderQuickAdd(null);

    expect(html).toContain('aria-label="Task title"');
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain('aria-label="Task priority: No priority"');
    expect(taskLabelPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: '',
        selectedLabelIds: [],
      }),
    );
    expect(taskPriorityPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPriority: 'none',
        label: 'Task priority',
        priorityOptions: expect.arrayContaining([
          expect.objectContaining({ value: 'none', label: 'No priority' }),
        ]),
      }),
    );
  });

  it('keeps the scoped project badge while naming the remaining form fields', () => {
    const html = renderQuickAdd({ id: 'project-1', name: 'Alpha' });

    expect(html).toContain('Alpha');
    expect(html).toContain('aria-label="Task title"');
    expect(html).not.toContain('aria-label="Project"');
    expect(html).toContain('aria-label="Task priority: No priority"');
    expect(taskLabelPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        labelOptions: [{ id: 'label-1', name: 'Bug', color: 'red' }],
      }),
    );
    expect(taskPriorityPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPriority: 'none',
        label: 'Task priority',
      }),
    );
  });

  it('queues an optimistic task before server persistence when online', async () => {
    const queueTaskCreate = vi.fn().mockResolvedValue({
      id: 'offline-task:1',
      taskKey: 'OFFLINE-123',
      title: 'Local-first card',
      status: 'inbox',
    });
    const onClose = vi.fn();
    const onTaskCreated = vi.fn();
    boardOfflineSyncMock.mockReturnValue({ queueTaskCreate });
    vi.stubGlobal('fetch', vi.fn());

    render(
      <KanbanQuickAdd
        selectedProject={{ id: 'project-1', name: 'Alpha', projectKey: 'PROJ' }}
        projectOptions={[{ id: 'project-1', name: 'Alpha', projectKey: 'PROJ' }]}
        projectLabelOptionsByProjectId={{
          'project-1': [{ id: 'label-1', name: 'Bug', color: 'red' }],
        }}
        editHrefBase="/board/PROJ"
        editHrefJoiner="?"
        onClose={onClose}
        onTaskCreated={onTaskCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: 'Local-first card' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(queueTaskCreate).toHaveBeenCalledWith({
        title: 'Local-first card',
        note: '',
        project: { id: 'project-1', name: 'Alpha', projectKey: 'PROJ' },
        labels: [],
        taskPriority: 'none',
        status: 'inbox',
      });
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(onTaskCreated).toHaveBeenCalledWith(expect.objectContaining({ taskKey: 'OFFLINE-123' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith('/board/PROJ?taskId=OFFLINE-123');
  });
});
