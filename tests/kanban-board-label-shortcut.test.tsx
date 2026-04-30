// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveKanbanTaskLabelOptions } from '@/app/components/kanban-board';
import { KanbanBoardMobile } from '@/app/components/kanban-board-mobile';
import { KanbanCardLabelShortcut } from '@/app/components/kanban-card-label-shortcut';
import { KanbanColumn } from '@/app/components/kanban-column';
import { updateKanbanTaskLabelsFromBoard } from '@/lib/kanban-board-label-shortcut';
import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';

const capturedCardProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const taskLabelPickerPropsMock = vi.hoisted(() => vi.fn());

vi.mock('@hello-pangea/dnd', () => ({
  Draggable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: (element: unknown) => void;
        draggableProps: Record<string, unknown>;
        dragHandleProps: Record<string, unknown>;
      },
      snapshot: { isDragging: boolean; isDropAnimating: boolean },
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => undefined,
        draggableProps: {},
        dragHandleProps: {},
      },
      { isDragging: false, isDropAnimating: false },
    ),
  Droppable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: (element: unknown) => void;
        droppableProps: Record<string, unknown>;
      },
      snapshot: { isDraggingOver: boolean },
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => undefined,
        droppableProps: {},
      },
      { isDraggingOver: false },
    ),
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: () => <div data-empty-state="true" />,
}));

vi.mock('@/app/hooks/use-mobile-tab-swipe', () => ({
  useMobileTabSwipe: () => ({}),
}));

vi.mock('@/app/components/kanban-card', () => ({
  KanbanCardContent: (props: Record<string, unknown>) => {
    capturedCardProps.push(props);
    return (
      <div data-testid={`kanban-card:${String((props.task as { taskKey: string }).taskKey)}`} />
    );
  },
}));

vi.mock('@/app/components/task-label-picker', () => ({
  TaskLabelPicker: (props: Record<string, unknown>) => {
    taskLabelPickerPropsMock(props);
    return (
      <button
        type="button"
        aria-label={String(props.triggerAriaLabel ?? 'Task label picker')}
        disabled={Boolean(props.disabled)}
        onClick={() => {
          const onChange = props.onChange as ((labelIds: string[]) => void) | undefined;
          const selectedLabelIds = Array.isArray(props.selectedLabelIds)
            ? (props.selectedLabelIds as string[])
            : [];
          const nextLabelId =
            Array.isArray(props.labelOptions) &&
            props.labelOptions[0] &&
            typeof props.labelOptions[0] === 'object' &&
            props.labelOptions[0] !== null &&
            'id' in props.labelOptions[0]
              ? String((props.labelOptions[0] as { id: string }).id)
              : 'label-a';

          onChange?.(selectedLabelIds.length > 0 ? selectedLabelIds : [nextLabelId]);
        }}
      >
        TaskLabelPicker
      </button>
    );
  },
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    task: {
      singular: 'Task',
      singularLower: 'task',
      plural: 'Tasks',
      pluralLower: 'tasks',
    },
    agents: {
      plural: 'AI agents',
      pluralLower: 'AI agents',
    },
    statuses: {
      inbox: 'Inbox',
      todo: 'Todo',
      hold: 'Hold',
      ready: 'Ready',
      done: 'Done',
      archived: 'Archived',
    },
    boardStatuses: {
      inbox: 'Inbox',
      todo: 'Planned',
      hold: 'Hold',
      ready: 'Ready',
      done: 'Done',
    },
  }),
}));

function buildTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-1',
    taskKey: 'PROJ-330',
    title: 'Add the label shortcut',
    note: null,
    status: 'todo',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date('2026-04-07T16:00:00.000Z').toISOString(),
    archivedAt: null,
    labels: [],
    ...overrides,
  };
}

const labelOptions = [
  { id: 'label-a', name: 'Feature', color: 'blue' },
  { id: 'label-b', name: 'UI', color: 'cyan' },
];

describe('kanban label shortcut wiring', () => {
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
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    capturedCardProps.length = 0;
    taskLabelPickerPropsMock.mockReset();
  });

  it('passes label options and the update callback from KanbanColumn into KanbanCardContent', () => {
    const onUpdateTaskLabels = vi.fn();

    renderToStaticMarkup(
      <MantineProvider>
        <KanbanColumn
          status="todo"
          tasks={[buildTask()]}
          isPending={false}
          isMobile={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn() } as never}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          labelOptions={labelOptions}
          onUpdateTaskLabels={onUpdateTaskLabels}
        />
      </MantineProvider>,
    );

    expect(capturedCardProps).toHaveLength(1);
    expect(capturedCardProps[0]?.labelOptions).toEqual(labelOptions);
    expect(capturedCardProps[0]?.onUpdateTaskLabels).toBe(onUpdateTaskLabels);
    expect(capturedCardProps[0]?.isMobile).toBe(false);
  });

  it('passes label options and the update callback through the mobile board renderer', () => {
    const onUpdateTaskLabels = vi.fn();

    renderToStaticMarkup(
      <MantineProvider>
        <KanbanBoardMobile
          columns={{
            inbox: [],
            todo: [buildTask()],
            hold: [],
            ready: [],
            done: [],
            archived: [],
          }}
          activeTab="todo"
          onTabChange={vi.fn()}
          isPending={false}
          editHrefBase="/board"
          editHrefJoiner="?"
          router={{ push: vi.fn() } as never}
          onQuickMoveTask={vi.fn()}
          onDeleteTask={vi.fn()}
          saveError={null}
          labelOptions={labelOptions}
          onUpdateTaskLabels={onUpdateTaskLabels}
        />
      </MantineProvider>,
    );

    expect(capturedCardProps).toHaveLength(1);
    expect(capturedCardProps[0]?.labelOptions).toEqual(labelOptions);
    expect(capturedCardProps[0]?.onUpdateTaskLabels).toBe(onUpdateTaskLabels);
    expect(capturedCardProps[0]?.isMobile).toBe(true);
  });

  it('uses the task project label options on all-project boards', () => {
    expect(
      resolveKanbanTaskLabelOptions({
        task: buildTask({
          project: { id: 'project-2', name: 'Beta', projectKey: 'BETA' },
        }),
        selectedProject: null,
        labelOptions: [],
        projectLabelOptionsByProjectId: {
          'project-2': [{ id: 'label-p2', name: 'Backend', color: 'green' }],
        },
      }),
    ).toEqual([{ id: 'label-p2', name: 'Backend', color: 'green' }]);
  });

  it('wires the shared task label picker inside the card shortcut with the task project scope', () => {
    renderToStaticMarkup(
      <MantineProvider>
        <KanbanCardLabelShortcut
          task={buildTask({
            project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
            labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
          })}
          labelOptions={labelOptions}
          isPending={false}
          onUpdateTaskLabels={vi.fn(async () => undefined)}
          renderLabelInline={(label) => <span>{label.name}</span>}
          renderLabelTooltipItem={(label) => <span>{label.name}</span>}
          labelTooltipStyles={{ arrow: {}, tooltip: {} }}
        />
      </MantineProvider>,
    );

    expect(taskLabelPickerPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        selectedLabelIds: ['label-a'],
        labelOptions,
      }),
    );
  });

  it('recovers from inline label save rejections without leaking unhandled rejections', async () => {
    const onUpdateTaskLabels = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to save labels.'))
      .mockResolvedValueOnce(undefined);
    const unhandledRejection = vi.fn();

    process.on('unhandledRejection', unhandledRejection);

    try {
      render(
        <MantineProvider>
          <KanbanCardLabelShortcut
            task={buildTask({
              project: { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA' },
              labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
            })}
            labelOptions={labelOptions}
            isPending={false}
            onUpdateTaskLabels={onUpdateTaskLabels}
            renderLabelInline={(label) => <span>{label.name}</span>}
            renderLabelTooltipItem={(label) => <span>{label.name}</span>}
            labelTooltipStyles={{ arrow: {}, tooltip: {} }}
          />
        </MantineProvider>,
      );

      const trigger = screen.getByRole('button', {
        name: 'Edit labels for Add the label shortcut',
      });

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(onUpdateTaskLabels).toHaveBeenCalledTimes(1);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandledRejection).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(trigger.hasAttribute('disabled')).toBe(false);
      });

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(onUpdateTaskLabels).toHaveBeenCalledTimes(2);
      });
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });
});

describe('updateKanbanTaskLabelsFromBoard', () => {
  it('patches task labels, upserts the returned board snapshot, and refreshes the open focused task', async () => {
    const boardTask = buildTask({
      labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
    });
    const focusedTask: EditableBoardTask = {
      id: 'focused-1',
      taskKey: 'PROJ-330',
      title: 'Add the label shortcut',
      branch: 'task/proj-330/add-the-label-shortcut',
      note: null,
      projectId: null,
      labelIds: ['label-a'],
      labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
      taskPriority: 'none',
      status: 'todo',
      engine: null,
      dispatchTarget: null,
      runState: null,
      runStateUpdatedAt: null,
      workLogs: [],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ boardTask, focusedTask }),
    });
    const upsertSnapshots = vi.fn();
    const setFocusedTask = vi.fn();
    const setSaveError = vi.fn();
    const notifyError = vi.fn();

    await updateKanbanTaskLabelsFromBoard({
      taskKey: 'PROJ-330',
      labelIds: ['label-a'],
      currentFocusedTaskKey: 'PROJ-330',
      fetchImpl,
      upsertSnapshots,
      setFocusedTask,
      setSaveError,
      notifyError,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/todos/PROJ-330', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ labelIds: ['label-a'] }),
    });
    expect(upsertSnapshots).toHaveBeenCalledWith([boardTask]);
    expect(setFocusedTask).toHaveBeenCalledWith(focusedTask);
    expect(setSaveError).toHaveBeenCalledWith(null);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('hydrates focused task work logs from the label PATCH response before updating the store', async () => {
    const boardTask = buildTask({
      labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        boardTask,
        focusedTask: {
          id: 'focused-1',
          taskKey: 'PROJ-330',
          title: 'Add the label shortcut',
          branch: 'task/proj-330/add-the-label-shortcut',
          note: null,
          projectId: null,
          labelIds: ['label-a'],
          labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
          taskPriority: 'none',
          status: 'todo',
          engine: null,
          dispatchTarget: null,
          runState: null,
          runStateUpdatedAt: null,
          workLogs: [
            {
              id: 'log-1',
              title: 'PREQSTATION Result · label refresh',
              detail: '**PR:** none',
              engine: null,
              workedAt: '2026-03-24T00:00:00.000Z',
              createdAt: '2026-03-24T01:00:00.000Z',
              todo: { engine: null },
            },
          ],
        },
      }),
    });
    const upsertSnapshots = vi.fn();
    const setFocusedTask = vi.fn();
    const setSaveError = vi.fn();
    const notifyError = vi.fn();

    await updateKanbanTaskLabelsFromBoard({
      taskKey: 'PROJ-330',
      labelIds: ['label-a'],
      currentFocusedTaskKey: 'PROJ-330',
      fetchImpl,
      upsertSnapshots,
      setFocusedTask,
      setSaveError,
      notifyError,
    });

    expect(setFocusedTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workLogs: [
          expect.objectContaining({
            workedAt: expect.any(Date),
            createdAt: expect.any(Date),
          }),
        ],
      }),
    );
  });

  it('does not clear the focused task when the label PATCH response omits focusedTask', async () => {
    const boardTask = buildTask({
      labels: [{ id: 'label-a', name: 'Feature', color: 'blue' }],
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, boardTask }),
    });
    const upsertSnapshots = vi.fn();
    const setFocusedTask = vi.fn();
    const setSaveError = vi.fn();
    const notifyError = vi.fn();

    await updateKanbanTaskLabelsFromBoard({
      taskKey: 'PROJ-330',
      labelIds: ['label-a'],
      currentFocusedTaskKey: 'PROJ-330',
      fetchImpl,
      upsertSnapshots,
      setFocusedTask,
      setSaveError,
      notifyError,
    });

    expect(upsertSnapshots).toHaveBeenCalledWith([boardTask]);
    expect(setFocusedTask).not.toHaveBeenCalled();
  });

  it('surfaces request failures without mutating board snapshots', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Failed to save labels.' }),
    });
    const upsertSnapshots = vi.fn();
    const setFocusedTask = vi.fn();
    const setSaveError = vi.fn();
    const notifyError = vi.fn();

    await updateKanbanTaskLabelsFromBoard({
      taskKey: 'PROJ-330',
      labelIds: ['label-a'],
      currentFocusedTaskKey: 'PROJ-998',
      fetchImpl,
      upsertSnapshots,
      setFocusedTask,
      setSaveError,
      notifyError,
    });

    expect(upsertSnapshots).not.toHaveBeenCalled();
    expect(setFocusedTask).not.toHaveBeenCalled();
    expect(setSaveError).toHaveBeenCalledWith('Failed to save labels.');
    expect(notifyError).toHaveBeenCalledWith('Failed to save labels.');
  });

  it('falls back to the offline task patch queue when label persistence fails', async () => {
    const boardTask = buildTask({
      labels: [{ id: 'label-b', name: 'UI', color: 'cyan' }],
    });
    const focusedTask: EditableBoardTask = {
      id: 'focused-1',
      taskKey: 'PROJ-330',
      title: 'Add the label shortcut',
      branch: 'task/proj-330/add-the-label-shortcut',
      note: null,
      projectId: null,
      labelIds: ['label-b'],
      labels: [{ id: 'label-b', name: 'UI', color: 'cyan' }],
      taskPriority: 'none',
      status: 'todo',
      engine: null,
      dispatchTarget: null,
      runState: null,
      runStateUpdatedAt: null,
      workLogs: [],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ error: 'Failed to save labels.' }),
    });
    const queueOfflineUpdate = vi.fn().mockResolvedValue({ boardTask, focusedTask });
    const upsertSnapshots = vi.fn();
    const setFocusedTask = vi.fn();
    const setSaveError = vi.fn();
    const notifyError = vi.fn();

    const didUpdate = await updateKanbanTaskLabelsFromBoard({
      taskKey: 'PROJ-330',
      labelIds: ['label-b'],
      currentFocusedTaskKey: 'PROJ-330',
      fetchImpl,
      queueOfflineUpdate,
      upsertSnapshots,
      setFocusedTask,
      setSaveError,
      notifyError,
    });

    expect(didUpdate).toBe(true);
    expect(queueOfflineUpdate).toHaveBeenCalledTimes(1);
    expect(upsertSnapshots).toHaveBeenCalledWith([boardTask]);
    expect(setFocusedTask).toHaveBeenCalledWith(focusedTask);
    expect(setSaveError).toHaveBeenCalledWith(null);
    expect(notifyError).not.toHaveBeenCalled();
  });
});
