import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

const formAction = vi.hoisted(() => vi.fn());
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () => [null, formAction],
  };
});

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: ({ label, name }: { label: string; name: string }) => (
    <div data-slot="live-markdown-editor" data-label={label} data-name={name} />
  ),
}));

vi.mock('@/app/components/submit-button', () => ({
  SubmitButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('@/app/components/task-label-picker', () => ({
  TaskLabelPicker: (props: Record<string, unknown>) => {
    taskLabelPickerPropsMock(props);
    return <div data-slot="task-label-picker" />;
  },
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { TaskFormPanel } from '@/app/components/panels/task-form-panel';

function renderTaskFormPanel() {
  return renderToStaticMarkup(
    <MantineProvider>
      <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
        <TaskFormPanel
          createTodoAction={vi.fn(async () => ({ ok: true as const }))}
          projects={[
            { id: 'project-1', name: 'Project One' },
            { id: 'project-2', name: 'Project Two' },
          ]}
          projectLabelsByProjectId={{
            'project-1': [
              { id: 'label-1', name: 'Frontend', color: '#228be6' },
              { id: 'label-2', name: 'Urgent', color: '#fa5252' },
            ],
            'project-2': [{ id: 'label-3', name: 'Backend', color: '#40c057' }],
          }}
          taskPriorityOptions={[
            { value: 'none', label: 'None' },
            { value: 'high', label: 'High' },
          ]}
          defaultProjectId="project-1"
        />
      </TerminologyProvider>
    </MantineProvider>,
  );
}

describe('TaskFormPanel layout', () => {
  it('renders setup, notes, and metadata sections instead of a single unstructured stack', () => {
    const html = renderTaskFormPanel();

    expect(html).toContain('data-layout="task-form-workbench"');
    expect(html).toContain('Ticket setup');
    expect(html).toContain('Notes');
    expect(html).toContain('Ticket metadata');
    expect(html).toContain('data-panel="task-form-setup"');
    expect(html).toContain('data-panel="task-form-notes"');
    expect(html).toContain('data-panel="task-form-metadata"');
  });

  it('keeps the markdown editor in the primary notes panel ahead of metadata controls', () => {
    const html = renderTaskFormPanel();

    expect(html).toContain('data-slot="live-markdown-editor"');
    expect(html).toContain('data-label="Ticket content (Markdown)"');
    expect(html.indexOf('data-panel="task-form-notes"')).toBeLessThan(
      html.indexOf('data-panel="task-form-metadata"'),
    );
    expect(html).toContain('data-slot="task-label-picker"');
    expect(html.indexOf('data-slot="live-markdown-editor"')).toBeLessThan(
      html.indexOf('data-slot="task-label-picker"'),
    );
    expect(html).toContain('Ticket title');
    expect(html).toContain('Create Ticket');
    expect(taskLabelPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        labelOptions: [
          { id: 'label-1', name: 'Frontend', color: '#228be6' },
          { id: 'label-2', name: 'Urgent', color: '#fa5252' },
        ],
      }),
    );
  });
});
