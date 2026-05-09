import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { taskPriorityOptionData } from '@/lib/task-meta';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const selectPropsMock = vi.hoisted(() => vi.fn());
const multiSelectPropsMock = vi.hoisted(() => vi.fn());
const menuPropsMock = vi.hoisted(() => vi.fn());
const menuItemPropsMock = vi.hoisted(() => vi.fn());
const triggerSaveMock = vi.hoisted(() => vi.fn());
const useAutoSaveMock = vi.hoisted(() => vi.fn());
const liveMarkdownEditorMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();
  const MenuMock = Object.assign(
    ({
      children,
      closeOnItemClick,
    }: {
      children?: React.ReactNode;
      closeOnItemClick?: boolean;
    }) => {
      menuPropsMock({ closeOnItemClick });

      return <div data-slot="menu">{children}</div>;
    },
    {
      Target: ({ children }: { children?: React.ReactNode }) => (
        <div data-slot="menu-target">{children}</div>
      ),
      Dropdown: ({ children }: { children?: React.ReactNode }) => (
        <div data-slot="menu-dropdown">{children}</div>
      ),
      Item: ({
        children,
        disabled,
        leftSection,
        onClick,
        rightSection,
        role,
        'data-task-priority-value': taskPriorityValue,
        'aria-checked': ariaChecked,
      }: {
        children?: React.ReactNode;
        disabled?: boolean;
        leftSection?: React.ReactNode;
        onClick?: () => void;
        rightSection?: React.ReactNode;
        role?: string;
        'data-task-priority-value'?: string;
        'aria-checked'?: boolean;
      }) => {
        menuItemPropsMock({ ariaChecked, children, disabled, onClick, role, taskPriorityValue });

        return (
          <button
            type="button"
            data-slot="menu-item"
            data-role={role ?? ''}
            data-checked={String(ariaChecked ?? '')}
            data-task-priority-value={taskPriorityValue}
            disabled={disabled}
            onClick={onClick}
          >
            {leftSection}
            <span data-slot="menu-item-label">{children}</span>
            {rightSection}
          </button>
        );
      },
    },
  );

  return {
    ...actual,
    Menu: MenuMock,
    MultiSelect: (props: {
      label?: string;
      data?: Array<{ value: string; label: string }>;
      value?: string[];
      onChange?: (value: string[]) => void;
      renderOption?: (input: {
        option: { value: string; label: string };
        checked?: boolean;
      }) => React.ReactNode;
      searchable?: boolean;
      clearable?: boolean;
    }) => {
      multiSelectPropsMock({ ...props });
      return <div data-slot={`multiselect:${props.label ?? 'unnamed'}`} />;
    },
    Select: (props: {
      name?: string;
      label?: string;
      data?: Array<{ value: string; label: string }>;
      defaultValue?: string | null;
      leftSection?: React.ReactNode;
      onChange?: (value: string | null) => void;
      renderOption?: (input: {
        option: { value: string; label: string };
        checked?: boolean;
      }) => React.ReactNode;
    }) => {
      selectPropsMock({ ...props });
      return <div data-slot={`select:${props.name ?? 'unnamed'}`} />;
    },
  };
});

vi.mock('@/app/components/auto-save-indicator', () => ({
  AutoSaveIndicator: () => null,
}));

vi.mock('@/app/components/live-markdown-editor', () => ({
  LiveMarkdownEditor: (props: unknown) => {
    liveMarkdownEditorMock(props);
    return <div data-slot="live-markdown-editor" />;
  },
}));

vi.mock('@/app/components/status-history-breadcrumb', () => ({
  StatusHistoryBreadcrumb: () => null,
}));

vi.mock('@/app/components/task-copy-actions', () => ({
  TaskCopyActions: () => null,
}));

vi.mock('@/app/components/work-log-timeline', () => ({
  WorkLogTimeline: () => null,
}));

vi.mock('@/app/hooks/use-auto-save', () => ({
  shouldFlushAutoSaveOnBlur: () => true,
  useAutoSave: () => useAutoSaveMock(),
}));

vi.mock('@/lib/engine-icons', () => ({
  getEngineConfig: () => null,
}));

vi.mock('@/lib/notifications', () => ({
  showErrorNotification: vi.fn(),
}));

import { TaskEditForm } from '@/app/components/task-edit-form';

function renderTaskEditForm(
  note: string | null,
  overrides: Partial<{
    labelIds: string[];
    labels: Array<{ id: string; name: string; color: string | null }>;
    todoLabels: Array<{ id: string; name: string; color: string | null }>;
    taskPriority: string;
    taskPriorityOptions: Array<{ value: string; label: string }>;
    runState: 'queued' | 'running' | null;
    artifacts: Array<{
      type: 'image' | 'video' | 'document' | 'link';
      title: string;
      url?: string | null;
      provider?: string | null;
      access?: string | null;
      expires?: string | null;
      localPath?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  }> = {},
) {
  useAutoSaveMock.mockReturnValue({
    markDirty: vi.fn(),
    triggerSave: triggerSaveMock,
    flushSave: vi.fn(),
    syncSnapshot: vi.fn(),
    status: 'idle',
    isDirty: false,
    isDirtyRef: { current: false },
  });

  liveMarkdownEditorMock.mockReset();
  multiSelectPropsMock.mockReset();
  menuPropsMock.mockReset();
  menuItemPropsMock.mockReset();
  selectPropsMock.mockReset();
  triggerSaveMock.mockReset();

  return renderToStaticMarkup(
    <MantineProvider>
      <TaskEditForm
        editableTodo={{
          id: 'task-1',
          taskKey: 'PROJ-208',
          title: 'Answer selection',
          note,
          projectId: null,
          labelIds: overrides.labelIds ?? [],
          labels: overrides.labels ?? [],
          taskPriority: overrides.taskPriority ?? 'none',
          status: 'hold',
          engine: null,
          artifacts: overrides.artifacts ?? [],
          runState: overrides.runState ?? null,
          runStateUpdatedAt: null,
          workLogs: [],
        }}
        projects={[]}
        todoLabels={overrides.todoLabels ?? []}
        taskPriorityOptions={overrides.taskPriorityOptions ?? [{ value: 'none', label: 'None' }]}
        updateTodoAction={async () => ({ ok: true })}
      />
    </MantineProvider>,
  );
}

describe('app/components/task-edit-form answer selection', () => {
  it('keeps preq-choice blocks in the markdown editor without rendering answer selection UI', () => {
    const html = renderTaskEditForm(
      [
        ':::preq-choice',
        'Which engine should handle this task?',
        '- [ ] Codex',
        '- [x] Claude',
        ':::',
      ].join('\n'),
    );

    expect(html).not.toContain('Which engine should handle this task?');
    expect(html).not.toContain('data-slot="choice-block"');
    expect(liveMarkdownEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultValue: [
          ':::preq-choice',
          'Which engine should handle this task?',
          '- [ ] Codex',
          '- [x] Claude',
          ':::',
        ].join('\n'),
      }),
    );
  });

  it('keeps notes without valid choice blocks in the markdown editor only', () => {
    const html = renderTaskEditForm('## Context\nPlain markdown note');

    expect(html).not.toContain('data-slot="choice-block"');
    expect(liveMarkdownEditorMock).toHaveBeenCalled();
  });

  it('renders an artifacts area below the notes editor when the note contains artifact urls', () => {
    const html = renderTaskEditForm(
      [
        '## Prototype',
        '',
        'Artifacts:',
        '- [image] Inbox screenshot | provider=fastio | access=private | url=https://fast.io/s/abc',
      ].join('\n'),
    );

    expect(html).toContain('Artifacts');
    expect(html).toContain('Inbox screenshot');
    expect(html.indexOf('data-slot="live-markdown-editor"')).toBeLessThan(
      html.indexOf('Artifacts'),
    );
  });

  it('renders structured artifacts below notes without requiring an artifact markdown block', () => {
    const html = renderTaskEditForm('## Prototype\nClean note body', {
      artifacts: [
        {
          type: 'document',
          title: 'HTML prototype',
          provider: 'fastio',
          access: 'private-workspace',
          url: 'https://fast.io/s/prototype',
        },
      ],
    });

    expect(html).toContain('Artifacts');
    expect(html).toContain('HTML prototype');
    expect(html).toContain('private-workspace');
    expect(html).not.toContain('Artifacts:');
  });

  it('preserves task priority and run state in hidden inputs without rendering a priority select', () => {
    const html = renderTaskEditForm('## Context\nPlain markdown note', {
      runState: 'queued',
    });

    const prioritySelectProps = selectPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === 'taskPriority');
    const runStateSelectProps = selectPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === 'runState');

    expect(prioritySelectProps).toBeUndefined();
    expect(runStateSelectProps).toBeUndefined();
    const priorityTriggerIndex = html.indexOf('data-task-priority-value="none"');
    const noPriorityLabelIndex = html.indexOf('>No priority</span>', priorityTriggerIndex);
    const noPriorityDotIndex = html.indexOf('aria-hidden="true"', priorityTriggerIndex);

    expect(html).toContain('type="hidden" name="taskPriority" value="none"');
    expect(html).toContain('data-task-priority-value="none"');
    expect(html).toContain('>No priority</span>');
    expect(noPriorityDotIndex).toBeGreaterThan(priorityTriggerIndex);
    expect(noPriorityDotIndex).toBeLessThan(noPriorityLabelIndex);
    expect(html).toContain('type="hidden" name="runState" value="queued"');
  });

  it('renders task priority as a contained settings select with detailed menu options', () => {
    const html = renderTaskEditForm('## Context\nPlain markdown note', {
      taskPriority: 'high',
      taskPriorityOptions: taskPriorityOptionData(),
    });

    const prioritySelectProps = selectPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === 'taskPriority');
    const highItemProps = menuItemPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.taskPriorityValue === 'high');
    const lowestItemProps = menuItemPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.taskPriorityValue === 'lowest');

    expect(prioritySelectProps).toBeUndefined();
    expect(html).toContain('data-task-priority-value="high"');
    expect(html).toContain('type="hidden" name="taskPriority" value="high"');
    expect(html).toContain('>High</span>');
    expect(html).toContain('Important, visible on card');
    expect(html).toContain('Parking lot');
    expect(html).not.toContain('data-slot="select:taskPriority"');
    expect(highItemProps).toEqual(
      expect.objectContaining({
        ariaChecked: true,
        role: 'menuitemradio',
      }),
    );
    expect(lowestItemProps).toEqual(
      expect.objectContaining({
        ariaChecked: false,
        role: 'menuitemradio',
      }),
    );
  });

  it('triggers autosave when the editable task settings change', () => {
    renderTaskEditForm('## Context\nPlain markdown note', {
      runState: 'queued',
    });

    const priorityNoneItemProps = menuItemPropsMock.mock.calls
      .map(([props]) => props)
      .find((props) => props.taskPriorityValue === 'none');

    priorityNoneItemProps?.onClick?.();

    expect(triggerSaveMock).toHaveBeenCalledTimes(1);
    expect(triggerSaveMock).toHaveBeenCalledWith(0);
  });

  it('renders selected task labels with the default edit form label trigger', () => {
    const html = renderTaskEditForm('## Context\nPlain markdown note', {
      labelIds: ['label-ui', 'label-bug', 'label-ops'],
      labels: [
        { id: 'label-ui', name: 'UI', color: '#228be6' },
        { id: 'label-bug', name: 'Bug', color: 'red' },
        { id: 'label-ops', name: 'Ops', color: 'green' },
      ],
      todoLabels: [
        { id: 'label-ui', name: 'UI', color: '#228be6' },
        { id: 'label-bug', name: 'Bug', color: 'red' },
        { id: 'label-ops', name: 'Ops', color: 'green' },
        { id: 'label-docs', name: 'Docs', color: 'yellow' },
      ],
    });

    expect(html).toContain('data-task-label-trigger="default"');
    expect(html).toContain('type="hidden" name="labelIds" value="label-ui"');
    expect(html).toContain('type="hidden" name="labelIds" value="label-bug"');
    expect(html).toContain('type="hidden" name="labelIds" value="label-ops"');
    expect(html).toContain('>UI, Bug, Ops</span>');
    expect(html).not.toContain('data-kanban-label-summary="true"');
    expect(html).not.toContain('>+2</span>');
    expect(html).not.toContain('data-slot="multiselect:Labels"');
  });

  it('uses the default empty label trigger in task settings', () => {
    const html = renderTaskEditForm('## Context\nPlain markdown note', {
      todoLabels: [{ id: 'label-ui', name: 'UI', color: '#228be6' }],
    });

    expect(html).toContain('data-task-label-trigger="default"');
    expect(html).toContain('>Select labels</span>');
    expect(html).toContain('>Labels</span>');
    expect(html).not.toContain('data-kanban-label-shortcut="empty"');
    expect(html).not.toContain('data-task-edit-empty-label-trigger="true"');
    expect(html).not.toContain('>+</span>');
  });
});
