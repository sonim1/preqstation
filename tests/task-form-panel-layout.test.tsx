// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

const formAction = vi.hoisted(() => vi.fn());
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());
const actionStateMock = vi.hoisted(() => ({
  current: null as { ok: true } | { ok: false; message: string } | null,
}));

vi.mock('@mantine/core', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const MenuContext = React.createContext({
    onChange: undefined as ((opened: boolean) => void) | undefined,
    opened: false,
  });

  const MenuRoot = ({
    children,
    onChange,
    opened = false,
  }: {
    children: React.ReactNode;
    onChange?: (opened: boolean) => void;
    opened?: boolean;
  }) => <MenuContext.Provider value={{ onChange, opened }}>{children}</MenuContext.Provider>;

  const Menu = Object.assign(MenuRoot, {
    Target: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    }) => {
      const { onChange, opened } = React.useContext(MenuContext);

      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          onChange?.(!opened);
        },
      });
    },
    Dropdown: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => {
      const { opened } = React.useContext(MenuContext);

      return opened ? <div {...props}>{children}</div> : null;
    },
    Item: ({
      children,
      leftSection,
      onClick,
      rightSection,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children: React.ReactNode;
      leftSection?: React.ReactNode;
      rightSection?: React.ReactNode;
    }) => (
      <button type="button" onClick={onClick} {...props}>
        {leftSection}
        {children}
        {rightSection}
      </button>
    ),
  });

  return {
    MantineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Menu,
    NativeSelect: ({
      data,
      label,
      name,
      onChange,
      required,
      value,
    }: {
      data: Array<{ value: string; label: string }>;
      label: string;
      name: string;
      onChange?: React.ChangeEventHandler<HTMLSelectElement>;
      required?: boolean;
      value?: string;
    }) => (
      <label>
        {label}
        <select name={name} onChange={onChange} required={required} value={value}>
          {data.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    ),
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Text: ({
      children,
      component: Component = 'p',
      ...props
    }: {
      children: React.ReactNode;
      component?: React.ElementType;
    }) => <Component {...props}>{children}</Component>,
    TextInput: ({
      label,
      name,
      placeholder,
      required,
    }: {
      label: string;
      name: string;
      placeholder?: string;
      required?: boolean;
    }) => (
      <label>
        {label}
        <input name={name} placeholder={placeholder} required={required} />
      </label>
    ),
    UnstyledButton: ({
      children,
      onClick,
      type = 'button',
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
      <button onClick={onClick} type={type} {...props}>
        {children}
      </button>
    ),
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () => [actionStateMock.current, formAction],
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
import taskFormPanelStyles from '@/app/components/panels/task-form-panel.module.css';

const taskFormPanelCss = fs.readFileSync(
  path.join(process.cwd(), 'app/components/panels/task-form-panel.module.css'),
  'utf8',
);

function getRuleBody(css: string, selector: string) {
  const selectorIndex = css.indexOf(selector);
  expect(selectorIndex).toBeGreaterThanOrEqual(0);

  const ruleStart = css.lastIndexOf('}', selectorIndex) + 1;
  const bodyStart = css.indexOf('{', selectorIndex);
  const bodyEnd = css.indexOf('}', selectorIndex);

  expect(bodyStart).toBeGreaterThan(ruleStart);
  expect(bodyEnd).toBeGreaterThan(bodyStart);

  return css.slice(bodyStart + 1, bodyEnd);
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

function taskFormPanelElement() {
  return (
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
    </MantineProvider>
  );
}

function renderTaskFormPanel() {
  return renderToStaticMarkup(taskFormPanelElement());
}

function renderTaskFormPanelClient() {
  return render(taskFormPanelElement());
}

beforeEach(() => {
  actionStateMock.current = null;
});

afterEach(() => {
  cleanup();
  taskLabelPickerPropsMock.mockClear();
});

describe('TaskFormPanel layout', () => {
  it('renders add task controls directly on the panel surface without card wrapper semantics', () => {
    const html = renderTaskFormPanel();
    const setupIndex = html.indexOf('data-panel="task-form-setup"');
    const notesIndex = html.indexOf('data-panel="task-form-notes"');
    const metadataIndex = html.indexOf('data-panel="task-form-metadata"');

    expect(html).toContain('data-layout="task-form-workbench"');
    expect(html).toContain('Ticket setup');
    expect(html).toContain('Notes');
    expect(html).toContain('Ticket metadata');
    expect(setupIndex).toBeGreaterThan(-1);
    expect(setupIndex).toBeLessThan(notesIndex);
    expect(notesIndex).toBeLessThan(metadataIndex);
    expect(html.indexOf('data-slot="task-label-picker"')).toBeLessThan(
      html.indexOf('name="taskPriority"'),
    );
    expect(html.indexOf('name="taskPriority"')).toBeLessThan(html.indexOf('Create Ticket'));
  });

  it('renders add task panels with flat section classes instead of nested card wrappers', () => {
    renderTaskFormPanelClient();

    expect(document.querySelector('[data-panel="task-form-setup"]')?.className).toContain(
      taskFormPanelStyles.setupSection,
    );
    expect(document.querySelector('[data-panel="task-form-notes"]')?.className).toContain(
      taskFormPanelStyles.notesSection,
    );
    expect(document.querySelector('[data-panel="task-form-metadata"]')?.className).toContain(
      taskFormPanelStyles.metaSection,
    );
  });

  it('keeps flat task form sections free of card surface styling', () => {
    const ruleBody = getRuleBody(taskFormPanelCss, '.notesSection');

    expect(ruleBody).not.toContain('border:');
    expect(ruleBody).not.toContain('border-radius:');
    expect(ruleBody).not.toContain('box-shadow:');
    expect(ruleBody).not.toContain('backdrop-filter:');
    expect(ruleBody).not.toContain('background:');
    expect(ruleBody).not.toContain('background-color:');
    expect(ruleBody).not.toContain('background-image:');
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

  it('renders priority as a custom picker while preserving the taskPriority form field', () => {
    const html = renderTaskFormPanel();

    expect(html).toContain('name="taskPriority"');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('data-task-priority-value="none"');
    expect(html).not.toContain('<select name="taskPriority"');
  });

  it('groups priority radio menu items for assistive technologies', async () => {
    renderTaskFormPanelClient();

    fireEvent.click(screen.getByRole('button', { name: 'Ticket priority: No priority' }));

    const group = await screen.findByRole('group', { name: 'Ticket priority' });

    expect(
      group.contains(screen.getByRole('menuitemradio', { name: 'No priority No marker on card' })),
    ).toBe(true);
    expect(
      group.contains(
        screen.getByRole('menuitemradio', { name: 'High Important, visible on card' }),
      ),
    ).toBe(true);
  });

  it('resets the selected priority after a successful submission state', async () => {
    const view = renderTaskFormPanelClient();
    const priorityInput = document.querySelector<HTMLInputElement>('input[name="taskPriority"]');

    expect(priorityInput?.value).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: 'Ticket priority: No priority' }));
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'High Important, visible on card' }),
    );

    await waitFor(() => {
      expect(priorityInput?.value).toBe('high');
    });

    actionStateMock.current = { ok: true };
    view.rerender(taskFormPanelElement());

    await waitFor(() => {
      expect(document.querySelector<HTMLInputElement>('input[name="taskPriority"]')?.value).toBe(
        'none',
      );
    });
  });
});
