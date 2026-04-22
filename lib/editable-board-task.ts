import type { EditableBoardTask } from '@/lib/kanban-store';

type EditableBoardTaskWorkLog = EditableBoardTask['workLogs'][number];

export type SerializedEditableBoardTaskWorkLog = Omit<
  EditableBoardTaskWorkLog,
  'workedAt' | 'createdAt'
> & {
  workedAt: string;
  createdAt: string;
};

export type SerializedEditableBoardTask = Omit<EditableBoardTask, 'workLogs'> & {
  workLogs: SerializedEditableBoardTaskWorkLog[];
};

export function serializeEditableBoardTask(task: EditableBoardTask): SerializedEditableBoardTask {
  return {
    ...task,
    workLogs: task.workLogs.map((log) => ({
      ...log,
      workedAt: log.workedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export function hydrateEditableBoardTask(task: SerializedEditableBoardTask): EditableBoardTask {
  return {
    ...task,
    workLogs: task.workLogs.map((log) => ({
      ...log,
      workedAt: new Date(log.workedAt),
      createdAt: new Date(log.createdAt),
    })),
  };
}
