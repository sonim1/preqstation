// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import taskEditFormClasses from '@/app/components/task-edit-form.module.css';

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
import {
  TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY,
  TASK_EDIT_PANEL_RESIZE_STORAGE_KEY,
} from '@/app/components/task-edit-panel-storage';
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
    routerReplaceMock.mockReset();
    taskEditFormPropsMock.mockClear();
    taskEditFormControllerMock.mockReset();
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
    expect(html).toContain(`data-resizable-storage-key="${TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}"`);
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

    const document = new DOMParser().parseFromString(html, 'text/html');
    const shell = document.querySelector('[data-layout="task-edit-shell"]');
    const mainColumn = document.querySelector('[data-panel="task-edit-main-column"]');
    const sidebar = document.querySelector('[data-panel="task-edit-sidebar"]');
    const notesPanel = document.querySelector('[data-panel="task-edit-notes-primary"]');
    const commentsPanel = document.querySelector('[data-panel="task-edit-comments"]');
    const activityPanel = document.querySelector('[data-panel="task-edit-activity"]');
    const dispatchPanel = document.querySelector('[data-panel="task-edit-dispatch"]');
    const metadataPanel = document.querySelector('[data-panel="task-edit-metadata"]');

    expect(shell).not.toBeNull();
    expect(mainColumn).not.toBeNull();
    expect(sidebar).not.toBeNull();

    if (!shell || !mainColumn || !sidebar) {
      throw new Error('Expected task edit skeleton layout panels to render.');
    }

    expect(
      Array.from(shell.children)
        .map((element) => element.getAttribute('data-panel'))
        .filter(Boolean),
    ).toEqual(['task-edit-main-column', 'task-edit-sidebar']);

    const mainPanels = Array.from(mainColumn.children)
      .map((element) => element.getAttribute('data-panel'))
      .filter(Boolean);
    const sidebarPanels = Array.from(sidebar.children)
      .map((element) => element.getAttribute('data-panel'))
      .filter(Boolean);

    expect(mainPanels).toEqual([
      'task-edit-notes-primary',
      'task-edit-comments',
      'task-edit-activity',
    ]);
    expect(sidebarPanels).toEqual(['task-edit-dispatch', 'task-edit-metadata']);
    expect(document.querySelector('[data-panel="task-edit-settings-card"]')).not.toBeNull();

    const allPanels = Array.from(document.querySelectorAll('[data-panel]'));

    expect(notesPanel).not.toBeNull();
    expect(commentsPanel).not.toBeNull();
    expect(activityPanel).not.toBeNull();
    expect(dispatchPanel).not.toBeNull();
    expect(metadataPanel).not.toBeNull();

    if (!notesPanel || !commentsPanel || !activityPanel || !dispatchPanel || !metadataPanel) {
      throw new Error('Expected task edit skeleton content panels to render.');
    }

    expect(notesPanel.classList).toContain(taskEditFormClasses.mainSectionSurface);
    expect(commentsPanel.classList).toContain(taskEditFormClasses.mainSectionSurface);
    expect(activityPanel.classList).toContain(taskEditFormClasses.mainSectionSurface);
    expect(notesPanel.classList).not.toContain(taskEditFormClasses.sectionSurface);
    expect(commentsPanel.classList).not.toContain(taskEditFormClasses.sectionSurface);
    expect(activityPanel.classList).not.toContain(taskEditFormClasses.sectionSurface);
    expect(dispatchPanel.classList).toContain(taskEditFormClasses.sectionSurface);
    expect(metadataPanel.classList).toContain(taskEditFormClasses.sectionSurface);
    expect(allPanels.indexOf(activityPanel)).toBeLessThan(allPanels.indexOf(dispatchPanel));
  });

  it('renders the edit form once detail is ready', async () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const view = render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="task-edit-form"]')).not.toBeNull();
    });

    expect(view.container.innerHTML).toContain(
      `data-resizable-storage-key="${TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}"`,
    );
    expect(view.container.querySelector('[data-testid="task-edit-loading-shell"]')).toBeNull();
    view.unmount();
  });

  it('uses the same persisted resize key for empty edit panels', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <EmptyTaskEditPanel closeHref="/board/PROJ" />
        </TerminologyProvider>
      </MantineProvider>,
    );

    expect(html).toContain(`data-resizable-storage-key="${TASK_EDIT_PANEL_RESIZE_STORAGE_KEY}"`);
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
      `data-fullscreen-storage-key="${TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}"`,
    );
    expect(loadingHtml).toContain(
      `data-fullscreen-storage-key="${TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}"`,
    );
    expect(emptyHtml).toContain(
      `data-fullscreen-storage-key="${TASK_EDIT_PANEL_FULLSCREEN_STORAGE_KEY}"`,
    );
  });

  it('places the autosave status in the modal header center for loaded edit panels', async () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const view = render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(view.container.querySelector('[data-slot="panel-save-status"]')).not.toBeNull();
    });

    expect(view.container.innerHTML).toContain('data-testid="task-panel-modal-header-center"');
    expect(view.container.innerHTML).toContain('data-status="saved"');
    expect(view.container.innerHTML).toContain('data-justify="center"');
    view.unmount();
  });

  it('closes the modal route after a successful dispatch queue action', async () => {
    taskEditFormControllerMock.mockReturnValue(buildController());
    const view = render(
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel
            {...BASE_PROPS}
            closeHref="/board/proj"
            editableTodo={{
              ...BASE_PROPS.editableTodo,
              id: '1',
              taskKey: 'PROJ-187',
              title: 'Update OpenClaw feature UI',
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

    await waitFor(() => {
      expect(taskEditFormPropsMock).toHaveBeenCalled();
    });

    const taskEditFormProps = taskEditFormPropsMock.mock.calls.at(-1)?.[0] as
      | {
          onDispatchQueued?: () => void;
        }
      | undefined;

    taskEditFormProps?.onDispatchQueued?.();

    expect(routerReplaceMock).toHaveBeenCalledWith('/board/proj');
    view.unmount();
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

  it('does not clear the saved draft again when only the controller object identity changes', async () => {
    const clearOfflineDraft = vi.fn();
    taskEditFormControllerMock.mockImplementation(() =>
      buildController({
        clearOfflineDraft,
        updateState: { ok: true },
      }),
    );

    const renderPanel = () => (
      <MantineProvider>
        <TerminologyProvider terminology={KITCHEN_TERMINOLOGY}>
          <TaskEditPanel {...BASE_PROPS} />
        </TerminologyProvider>
      </MantineProvider>
    );
    const view = render(renderPanel());

    await waitFor(() => {
      expect(clearOfflineDraft).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      view.rerender(renderPanel());
      await Promise.resolve();
    });

    expect(taskEditFormControllerMock).toHaveBeenCalledTimes(2);
    expect(clearOfflineDraft).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
