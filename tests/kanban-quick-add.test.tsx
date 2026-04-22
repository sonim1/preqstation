import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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
  MultiSelect: ({
    value,
    placeholder,
    searchable: _searchable,
    clearable: _clearable,
    onChange: _onChange,
    data: _data,
    ...props
  }: {
    value?: string[];
    placeholder?: string;
    searchable?: boolean;
    clearable?: boolean;
    onChange?: (value: string[]) => void;
    data?: Array<{ value: string; label: string }>;
    'aria-label'?: string;
  }) => (
    <input
      readOnly
      data-multiselect="true"
      defaultValue={value?.join(',') ?? ''}
      placeholder={placeholder}
      {...props}
    />
  ),
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
    onChange: _onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input defaultValue={value} placeholder={placeholder} {...props} />
  ),
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
  it('renders accessible names for all interactive fields on all-project boards', () => {
    const html = renderQuickAdd(null);

    expect(html).toContain('aria-label="Task title"');
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain('aria-label="Labels"');
    expect(html).toContain('aria-label="Priority"');
  });

  it('keeps the scoped project badge while naming the remaining form fields', () => {
    const html = renderQuickAdd({ id: 'project-1', name: 'Alpha' });

    expect(html).toContain('Alpha');
    expect(html).toContain('aria-label="Task title"');
    expect(html).not.toContain('aria-label="Project"');
    expect(html).toContain('aria-label="Labels"');
    expect(html).toContain('aria-label="Priority"');
  });
});
