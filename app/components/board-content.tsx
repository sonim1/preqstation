'use client';

import { Container, Stack } from '@mantine/core';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BoardEventSync } from '@/app/components/board-event-sync';
import { BoardOfflineSyncProvider } from '@/app/components/board-offline-sync-provider';
import { BoardTaskPanel } from '@/app/components/board-task-panel';
import { buildArchivedTasksRequestPath, KanbanBoard } from '@/app/components/kanban-board';
import { KanbanStoreProvider } from '@/app/components/kanban-store-provider';
import { OfflineBoardHydrator } from '@/app/components/offline-board-hydrator';
import {
  buildBoardTaskEditHref,
  resolveBoardTaskPanelLocation,
} from '@/lib/board-task-panel-location';
import type { EnginePresets, KanbanColumns, KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import type { ProjectBackgroundCredit } from '@/lib/project-backgrounds';
import type { QaRunView } from '@/lib/qa-runs';

type BoardContentProps = {
  kanbanTasks: KanbanColumns;
  editHrefBase: string;
  boardHref: string;
  telegramEnabled: boolean;
  hermesTelegramEnabled?: boolean;
  projects: { id: string; name: string }[];
  todoLabels: { id: string; name: string; color: string }[];
  projectLabelOptionsByProjectId?: Record<
    string,
    Array<{ id: string; name: string; color: string }>
  >;
  selectedProject: { id: string; name: string; projectKey: string } | null;
  activePanel: 'task-edit' | null;
  editableTodo: EditableBoardTask | null;
  taskPriorityOptions: { value: string; label: string }[];
  updateTodoAction: (
    prevState: unknown,
    formData: FormData,
  ) => Promise<
    | { ok: true; boardTask?: KanbanTask | null; focusedTask?: EditableBoardTask | null }
    | { ok: false; message: string }
    | null
  >;
  bgImageUrl?: string | null;
  bgImageCredit?: ProjectBackgroundCredit | null;
  enginePresets?: EnginePresets | null;
  initialArchivedCount: number;
  archiveProjectId: string | null;
  readyQaConfig?: {
    projectId: string;
    projectKey: string;
    projectName: string;
    branchName: string;
    runs: QaRunView[];
  } | null;
};

export function BoardContent({
  kanbanTasks,
  editHrefBase,
  boardHref,
  telegramEnabled,
  hermesTelegramEnabled,
  projects,
  todoLabels,
  projectLabelOptionsByProjectId = {},
  selectedProject,
  activePanel,
  editableTodo,
  taskPriorityOptions,
  updateTodoAction,
  bgImageUrl: _bgImageUrl,
  bgImageCredit: _bgImageCredit,
  enginePresets,
  initialArchivedCount,
  archiveProjectId,
  readyQaConfig = null,
}: BoardContentProps) {
  const searchParams = useSearchParams();
  const [archivedCount, setArchivedCount] = useState(initialArchivedCount);

  useEffect(() => {
    setArchivedCount(initialArchivedCount);
  }, [initialArchivedCount]);

  const clientPanelLocation = useMemo(() => {
    if (!searchParams) {
      return {
        activePanel,
        taskKey: editableTodo?.taskKey ?? null,
      };
    }

    return resolveBoardTaskPanelLocation(`?${searchParams.toString()}`);
  }, [activePanel, editableTodo?.taskKey, searchParams]);

  const openTaskEditor = useCallback(
    (task: KanbanTask) => {
      window.history.pushState(null, '', buildBoardTaskEditHref(editHrefBase, task.taskKey));
    },
    [editHrefBase],
  );

  const closeTaskEditor = useCallback(() => {
    window.history.replaceState(null, '', boardHref);
  }, [boardHref]);

  const refreshArchivedCount = useCallback(async () => {
    const response = await fetch(
      buildArchivedTasksRequestPath({
        projectId: archiveProjectId,
        query: '',
        limit: 1,
        offset: 0,
        summaryOnly: true,
      }),
      { credentials: 'same-origin' },
    );
    if (!response.ok) {
      throw new Error(`Archived count refresh failed: ${response.status}`);
    }

    const payload = (await response.json()) as { total?: number };
    setArchivedCount(typeof payload.total === 'number' ? payload.total : 0);
  }, [archiveProjectId]);

  return (
    <KanbanStoreProvider initialColumns={kanbanTasks} initialFocusedTask={editableTodo}>
      <OfflineBoardHydrator boardKey={selectedProject?.projectKey ?? 'ALL'} />
      <BoardOfflineSyncProvider
        editHrefBase={editHrefBase}
        activeProjectId={selectedProject?.id ?? null}
      >
        <Container className="dashboard-root is-board" fluid px={0} py={0}>
          <Stack gap="md" className="dashboard-stack is-board">
            <section className="kanban-stage">
              <div className="kanban-stage-content">
                <BoardEventSync
                  projectId={selectedProject?.id ?? null}
                  onArchivedCountRefresh={refreshArchivedCount}
                />
                <KanbanBoard
                  serverColumns={kanbanTasks}
                  archivedCount={archivedCount}
                  archiveProjectId={archiveProjectId}
                  onArchivedCountChange={setArchivedCount}
                  editHrefBase={editHrefBase}
                  telegramEnabled={telegramEnabled}
                  projectOptions={projects.map((project) => ({
                    id: project.id,
                    name: project.name,
                  }))}
                  labelOptions={todoLabels.map((label) => ({
                    id: label.id,
                    name: label.name,
                    color: label.color,
                  }))}
                  projectLabelOptionsByProjectId={projectLabelOptionsByProjectId}
                  selectedProject={selectedProject}
                  enginePresets={enginePresets ?? null}
                  readyQaConfig={readyQaConfig}
                  onOpenTaskEditor={openTaskEditor}
                />
              </div>
            </section>
          </Stack>

          <BoardTaskPanel
            activePanel={clientPanelLocation.activePanel}
            activeTaskKey={clientPanelLocation.taskKey}
            boardHref={boardHref}
            serverFocusedTask={editableTodo}
            projects={projects}
            projectLabelOptionsByProjectId={projectLabelOptionsByProjectId}
            taskPriorityOptions={taskPriorityOptions}
            updateTodoAction={updateTodoAction}
            telegramEnabled={telegramEnabled}
            hermesTelegramEnabled={hermesTelegramEnabled}
            onClose={closeTaskEditor}
          />
        </Container>
      </BoardOfflineSyncProvider>
    </KanbanStoreProvider>
  );
}
