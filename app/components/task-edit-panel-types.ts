import type { KanbanTask } from '@/lib/kanban-helpers';
import type { EditableBoardTask } from '@/lib/kanban-store';
import type { TaskArtifact } from '@/lib/task-artifacts';

import type { WorkGraphPayload } from './work-graph-tree';

type TaskEditActionState =
  | { ok: true; boardTask?: KanbanTask | null; focusedTask?: EditableBoardTask | null }
  | { ok: false; message: string }
  | null;

export type TaskEditPanelProps = {
  closeHref: string;
  editableTodo: {
    id: string;
    taskKey: string;
    title: string;
    branch?: string | null;
    note: string | null;
    artifacts?: TaskArtifact[] | null;
    projectId: string | null;
    labelIds: string[];
    labels: Array<{ id: string; name: string; color: string | null }>;
    taskPriority: string;
    status: string;
    engine?: string | null;
    dispatchTarget?: EditableBoardTask['dispatchTarget'];
    runState?: 'queued' | 'running' | null;
    runStateUpdatedAt?: string | null;
    workLogs?: Array<{
      id: string;
      title: string;
      detail?: string | null;
      engine?: string | null;
      workedAt: Date;
      createdAt: Date;
      todo?: { engine: string | null } | null;
    }>;
    workGraph?: WorkGraphPayload | null;
  };
  projects: Array<{ id: string; name: string }>;
  todoLabels: Array<{ id: string; name: string; color: string | null }>;
  taskPriorityOptions: Array<{ value: string; label: string }>;
  updateTodoAction: (prevState: unknown, formData: FormData) => Promise<TaskEditActionState>;
  branchName?: string | null;
  telegramEnabled?: boolean;
  hermesTelegramEnabled?: boolean;
  hermesBotUsername?: string | null;
  onTaskQueued?: (
    taskKey: string,
    queuedAt: string,
    dispatchTarget: KanbanTask['dispatchTarget'],
  ) => void;
  onDispatchQueued?: () => void;
  onTaskUpdated?: (result: {
    boardTask?: KanbanTask | null;
    focusedTask?: EditableBoardTask | null;
  }) => void;
  onProjectLabelOptionsChange?: (
    projectId: string,
    labelOptions: Array<{ id: string; name: string; color: string | null }>,
  ) => void;
  isLoading?: boolean;
  onClose?: () => void;
  opened?: boolean;
  size?: string;
};
