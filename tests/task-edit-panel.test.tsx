// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerReplaceMock = vi.hoisted(() => vi.fn());
const taskEditFormPropsMock = vi.hoisted(() => vi.fn());
const taskEditFormControllerMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}));

vi.mock('@/app/components/task-panel-modal', () => ({
  TaskPanelModal: ({
    children,
    title,
    headerCenterContent,
    closeHref,
    closeOnEscape,
    fullscreenStorageKey,
    resizableStorageKey,
  }: {
    children: React.ReactNode;
    title: string;
    headerCenterContent?: React.ReactNode;
    closeHref: string;
    closeOnEscape?: boolean;
    fullscreenStorageKey?: string;
    resizableStorageKey?: string;
  }) => (
    <div
      data-testid="task-panel-modal"
      data-title={title}
      data-close-href={closeHref}
      data-close-on-escape={String(closeOnEscape)}
      data-fullscreen-storage-key={fullscreenStorageKey ?? ''}
      data-resizable-storage-key={resizableStorageKey ?? ''}
    >
      <div data-testid="task-panel-modal-header-center">{headerCenterContent}</div>
      {children}
    </div>
  ),
}));

vi.mock('@/app/components/auto-save-indicator', () => ({
  AutoSaveIndicator: ({ justify, status }: { justify?: string; status: string }) => (
    <div data-slot="panel-save-status" data-justify={justify ?? ''} data-status={status}>
      Saved
    </div>
  ),
}));

vi.mock('@/app/components/task-edit-form', () => ({
  TaskEditForm: (props: unknown) => {
    taskEditFormPropsMock(props);
    return <div data-testid="task-edit-form" />;
  },
  useTaskEditFormController: () => taskEditFormControllerMock(),
}));

vi.mock('@/app/components/task-edit-header-title', () => ({
  TaskEditHeaderTitle: () => <div data-testid="task-edit-header-title" />,
}));

import { EmptyTaskEditPanel, TaskEditPanel } from '@/app/components/task-edit-panel';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { KITCHEN_TERMINOLOGY } from '@/lib/terminology';

const BASE_PROPS = {
  closeHref: '/board/PROJ',
  editableTodo: {
    id: 'task-1',
    taskKey: 'PROJ-310',
    title: 'Fast open task',
    branch: 'task/proj-310/fast-open',
    note: '## Context',
    projectId: 'project-1',
    labelIds: [],
    labels: [],
    taskPriority: 'none',
    status: 'todo',
    engine: 'codex',
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [],
  },
  projects: [],
  todoLabels: [],
  taskPriorityOptions: [{ value: 'none', label: 'None' }],
  updateTodoAction: async () => ({ ok: true as const }),
  telegramEnabled: false,
};

describe('app/components/task-edit-panel', () => {
  function buildController(overrides: Record<string, unknown> = {}) {
    return {
      clearOfflineDraft: vi.fn(),
      fieldRenderKey: 'task-edit-form:test',
      flushOnBlur: vi.fn(),
      formId: 'task-edit-form:test',
      markDirty: vi.fn(),
      saveStatus: 'saved',
      titleRenderKey: 'task-edit-title:test',
      updateState: null,
      updateTitleDraft: vi.fn(),
      draftTitle: BASE_PROPS.editableTodo.title,
      ...overrides,
    };
  }

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

  it('renders a loading skeleton instead of the form while focused task detail is hydrating', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TaskEditPanel {...BASE_PROPS} isLoading />
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-resizable-storage-key="preqstation:task-edit-panel:size:v1"');
    expect(html).toContain('data-testid="task-edit-loading-shell"');
    expect(html).not.toContain('data-testid="task-edit-form"');
  });

  it('matches the loaded edit form layout order while loading task detail', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TaskEditPanel {...BASE_PROPS} isLoading />
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="task-edit-loading-shell"');
    expect(html).toContain('data-layout="task-edit-shell"');
    expect(html).toContain('data-panel="task-edit-main-column"');
    expect(html).toContain('data-panel="task-edit-sidebar"');
    expect(html).toContain('data-panel="task-edit-dispatch"');
    expect(html).toContain('data-panel="task-edit-metadata"');
    expect(html).toContain('data-panel="task-edit-notes-primary"');
    expect(html).toContain('data-panel="task-edit-activity"');
    expect(html.indexOf('data-panel="task-edit-main-column"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-sidebar"'),
    );
    expect(html.indexOf('data-panel="task-edit-notes-primary"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-activity"'),
    );
    expect(html.indexOf('data-panel="task-edit-sidebar"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-dispatch"'),
    );
    expect(html.indexOf('data-panel="task-edit-dispatch"')).toBeLessThan(
      html.indexOf('data-panel="task-edit-metadata"'),
    );
  });

  it('renders the edit form once detail is ready', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="task-edit-form"');
    expect(html).toContain('data-resizable-storage-key="preqstation:task-edit-panel:size:v1"');
    expect(html).not.toContain('data-testid="task-edit-loading-shell"');
  });

  it('uses the same persisted resize key for empty edit panels', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <EmptyTaskEditPanel closeHref="/board/PROJ" />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain('data-resizable-storage-key="preqstation:task-edit-panel:size:v1"');
  });

  it('uses the same persisted fullscreen key for loaded, loading, and empty edit panels', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());

    const loadedHtml = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );
    const loadingHtml = renderToStaticMarkup(
      <MantineProvider>
        <TaskEditPanel {...BASE_PROPS} isLoading />
      </MantineProvider>,
    );
    const emptyHtml = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <EmptyTaskEditPanel closeHref="/board/PROJ" />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(loadedHtml).toContain(
      'data-fullscreen-storage-key="preqstation:task-edit-panel:fullscreen:v1"',
    );
    expect(loadingHtml).toContain(
      'data-fullscreen-storage-key="preqstation:task-edit-panel:fullscreen:v1"',
    );
    expect(emptyHtml).toContain(
      'data-fullscreen-storage-key="preqstation:task-edit-panel:fullscreen:v1"',
    );
  });

  it('places the autosave status in the modal header center for loaded edit panels', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain('data-testid="task-panel-modal-header-center"');
    expect(html).toContain('data-slot="panel-save-status"');
    expect(html).toContain('data-status="saved"');
    expect(html).toContain('data-justify="center"');
  });

  it('closes the modal route after a successful dispatch queue action', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel
            {...BASE_PROPS}
            closeHref="/board/proj"
            editableTodo={{
              ...BASE_PROPS.editableTodo,
              id: '1',
              taskKey: 'PROJ-187',
              title: 'OpenClaw 기능 UI수정',
              note: 'Move the actions into the form meta header.',
            }}
            projects={[{ id: 'project-1', name: 'Project Manager' }]}
            updateTodoAction={vi.fn(async () => ({ ok: true as const }))}
            branchName="task/proj-187/openclaw-gineung-uisujeong"
            telegramEnabled
          />
        </TerminologyProvider>
      </MantineProvider>,
    );

    const taskEditFormProps = taskEditFormPropsMock.mock.calls.at(-1)?.[0] as {
      onDispatchQueued?: () => void;
    };

    taskEditFormProps.onDispatchQueued?.();

    expect(routerReplaceMock).toHaveBeenCalledWith('/board/proj');
  });

  it('keeps escape-close enabled for the loaded task edit panel', () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain('data-close-on-escape="true"');
  });

  it('clears the saved draft after a successful task update', async () => {
    const clearOfflineDraft = vi.fn();
    taskEditFormControllerMock.mockReturnValue(
      buildController({
        clearOfflineDraft,
        updateState: { ok: true },
      }),
    );

    render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(clearOfflineDraft).toHaveBeenCalledTimes(1);
    });
  });
});
