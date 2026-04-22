export type TaskEditRevisionSource = {
  taskKey: string;
  title: string;
  note: string | null;
  labelIds: string[];
  taskPriority: string;
  runState?: 'queued' | 'running' | null;
};

export type TaskEditFieldRevisions = {
  title: string;
  note: string;
  labels: string;
  taskPriority: string;
  runState: string;
};

function serializeTaskEditRevision(entries: Array<[string, string]>) {
  return JSON.stringify(entries);
}

export function buildTaskEditRevision(task: TaskEditRevisionSource) {
  return serializeTaskEditRevision([
    ['taskKey', task.taskKey],
    ['title', task.title],
    ['note', task.note ?? ''],
    ['labelIds', task.labelIds.join(',')],
    ['taskPriority', task.taskPriority],
    ['runState', task.runState ?? ''],
  ]);
}

export function buildTaskEditFieldRevisions(task: TaskEditRevisionSource): TaskEditFieldRevisions {
  return {
    title: serializeTaskEditRevision([
      ['taskKey', task.taskKey],
      ['title', task.title],
    ]),
    note: serializeTaskEditRevision([
      ['taskKey', task.taskKey],
      ['note', task.note ?? ''],
    ]),
    labels: serializeTaskEditRevision([
      ['taskKey', task.taskKey],
      ['labelIds', task.labelIds.join(',')],
    ]),
    taskPriority: serializeTaskEditRevision([
      ['taskKey', task.taskKey],
      ['taskPriority', task.taskPriority],
    ]),
    runState: serializeTaskEditRevision([
      ['taskKey', task.taskKey],
      ['runState', task.runState ?? ''],
    ]),
  };
}

export function shouldHydrateTaskEditRevision(params: {
  previousRevision: string;
  nextRevision: string;
  isDirty: boolean;
}) {
  return !params.isDirty && params.previousRevision !== params.nextRevision;
}
