// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskEditHeaderTitle } from '@/app/components/task-edit-header-title';

describe('app/components/task-edit-header-title', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the workflow badge to the left of the task title instead of a visible dialog eyebrow', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TaskEditHeaderTitle
          dialogLabel="Edit Task"
          formId="task-edit-form-1"
          placeholder="Enter task title"
          title="Compact edit modal refresh"
          titleLabel="Task title"
          statusBadge={<span data-slot="workflow-status">Todo</span>}
          onBlur={vi.fn()}
          onChange={vi.fn()}
          onTitleChange={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Compact edit modal refresh');
    expect(html).toContain('data-slot="workflow-status"');
    expect(html.indexOf('data-slot="workflow-status"')).toBeLessThan(
      html.lastIndexOf('Compact edit modal refresh'),
    );
    expect(html).not.toContain('Edit Task');
  });

  it('keeps the hidden title input while showing the placeholder and workflow badge', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TaskEditHeaderTitle
          dialogLabel="Edit Task"
          formId="task-edit-form-1"
          placeholder="Enter task title"
          title=""
          titleLabel="Task title"
          statusBadge={<span data-slot="workflow-status">Inbox</span>}
          onBlur={vi.fn()}
          onChange={vi.fn()}
          onTitleChange={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('name="title"');
    expect(html).toContain('value=""');
    expect(html).toContain('Enter task title');
    expect(html).toContain('data-slot="workflow-status"');
    expect(html).not.toContain('Edit Task');
  });

  it('hydrates the saved title draft into the hidden title input', () => {
    render(
      <MantineProvider>
        <TaskEditHeaderTitle
          formId="task-edit-form:test"
          placeholder="Enter task title"
          title="복구된 제목"
          titleLabel="Task title"
          onBlur={vi.fn()}
          onChange={vi.fn()}
          onTitleChange={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByDisplayValue('복구된 제목')).toBeTruthy();
  });

  it('updates the hidden title input while editing', () => {
    function ControlledTitle() {
      const [title, setTitle] = React.useState('원본 제목');

      return (
        <TaskEditHeaderTitle
          formId="task-edit-form:test"
          placeholder="Enter task title"
          title={title}
          titleLabel="Task title"
          onBlur={vi.fn()}
          onChange={vi.fn()}
          onTitleChange={setTitle}
        />
      );
    }

    render(
      <MantineProvider>
        <ControlledTitle />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByLabelText('Edit task title'));
    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: '변경된 제목' },
    });

    expect(screen.getAllByDisplayValue('변경된 제목')).toHaveLength(2);
  });
});
