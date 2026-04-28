import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/components/confirm-action-button', () => ({
  ConfirmActionButton: ({
    children,
    confirmLabel,
    confirmMessage,
    confirmTitle,
    formId,
  }: {
    children: React.ReactNode;
    confirmLabel?: React.ReactNode;
    confirmMessage?: React.ReactNode;
    confirmTitle?: React.ReactNode;
    formId?: string;
  }) => (
    <button
      type="button"
      data-confirm-label={String(confirmLabel ?? '')}
      data-confirm-message={String(confirmMessage ?? '')}
      data-confirm-title={String(confirmTitle ?? '')}
      data-form-id={formId ?? ''}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-empty-state="true">
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('@/app/components/settings-label-form', () => ({
  SettingsLabelForm: ({
    action: _action,
    children,
    id,
  }: {
    action: unknown;
    children: React.ReactNode;
    id?: string;
  }) => <form id={id}>{children}</form>,
  SettingsLabelNameInput: ({
    label,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) => (
    <label>
      {label}
      <input {...props} />
    </label>
  ),
  TaskLabelColorField: ({
    defaultColor,
    label,
    showLabel,
  }: {
    defaultColor?: string;
    label?: React.ReactNode;
    showLabel?: boolean;
  }) => <div data-color-field={defaultColor ?? ''}>{showLabel === false ? null : label}</div>,
  SettingsLabelSubmitButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="submit" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/app/components/submit-button', () => ({
  SubmitButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="submit" {...props}>
      {children}
    </button>
  ),
}));

import { ProjectLabelsPanel } from '@/app/components/panels/project-labels-panel';

function renderPanel(
  labels: Array<{ id: string; name: string; color: string; usageCount: number }> = [],
  options: { taskPluralLower?: string; taskSingularLower?: string } = {},
) {
  return renderToStaticMarkup(
    <MantineProvider>
      <ProjectLabelsPanel
        labels={labels}
        taskPluralLower={options.taskPluralLower ?? 'tasks'}
        taskSingularLower={options.taskSingularLower ?? 'task'}
        createLabelAction={vi.fn(async () => null)}
        updateLabelAction={vi.fn(async () => null)}
        deleteLabelAction={vi.fn(async () => null)}
      />
    </MantineProvider>,
  );
}

describe('app/components/panels/project-labels-panel', () => {
  it('renders the empty state when a project has no labels yet', () => {
    const html = renderPanel();

    expect(html).toContain('No labels yet');
    expect(html).toContain(
      'Create your first project label above to categorize this project&#x27;s tasks.',
    );
  });

  it('shows per-label usage context before the edit controls', () => {
    const html = renderPanel([
      { id: 'label-1', name: 'Bug', color: 'red', usageCount: 2 },
      { id: 'label-2', name: 'Feature', color: 'blue', usageCount: 0 },
    ]);

    expect(html).toContain('Used by 2 tasks');
    expect(html).toContain('Not used yet');
  });

  it('uses stronger delete confirmation copy for labels still attached to tasks', () => {
    const html = renderPanel([
      { id: 'label-1', name: 'Bug', color: 'red', usageCount: 2 },
      { id: 'label-2', name: 'Feature', color: 'blue', usageCount: 0 },
    ]);

    expect(html).toContain('data-form-id="project-label-delete-label-1"');
    expect(html).toContain(
      'data-confirm-message="Deleting this label will remove it from 2 tasks. This cannot be undone."',
    );
    expect(html).toContain('data-confirm-message="Deleting this label cannot be undone."');
  });

  it('uses custom singular terminology for one-item usage and delete confirmation copy', () => {
    const html = renderPanel([{ id: 'label-1', name: 'Bug', color: 'red', usageCount: 1 }], {
      taskPluralLower: 'tickets',
      taskSingularLower: 'ticket',
    });

    expect(html).toContain('Used by 1 ticket');
    expect(html).toContain(
      'data-confirm-message="Deleting this label will remove it from 1 ticket. This cannot be undone."',
    );
  });

  it('renders subsection headings, visible field labels, and specific row action copy', () => {
    const html = renderPanel([{ id: 'label-1', name: 'Bug', color: 'red', usageCount: 1 }]);

    expect(html).toMatch(/<h[1-6][^>]*>Create label<\/h[1-6]>/);
    expect(html).toMatch(/<h[1-6][^>]*>Manage labels<\/h[1-6]>/);
    expect(html).toMatch(/<label[^>]*>Name<input/);
    expect(html).toContain('>Color<');
    expect(html).toMatch(/<button[^>]*>Save label<\/button>/);
    expect(html).toMatch(/<button[^>]*>Delete label<\/button>/);
  });
});
