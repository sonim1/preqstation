import { describe, expect, it } from 'vitest';

import { hydrateEditableBoardTask, serializeEditableBoardTask } from '@/lib/editable-board-task';
import type { EditableBoardTask } from '@/lib/kanban-store';

function buildEditableTask(): EditableBoardTask {
  return {
    id: 'task-1',
    taskKey: 'PROJ-255',
    title: 'Task',
    branch: 'task/proj-255/event-refresh',
    note: '## Context',
    projectId: 'project-1',
    labelIds: ['label-1'],
    labels: [{ id: 'label-1', name: 'Bug', color: 'blue' }],
    taskPriority: 'none',
    status: 'todo',
    engine: null,
    dispatchTarget: null,
    runState: null,
    runStateUpdatedAt: null,
    workLogs: [
      {
        id: 'log-1',
        title: 'Updated task',
        detail: 'detail',
        engine: null,
        workedAt: new Date('2026-03-24T00:00:00.000Z'),
        createdAt: new Date('2026-03-24T01:00:00.000Z'),
        todo: { engine: null },
      },
    ],
  };
}

describe('lib/editable-board-task', () => {
  it('serializes work-log timestamps to ISO strings for the todo detail route payload', () => {
    expect(serializeEditableBoardTask(buildEditableTask())).toEqual(
      expect.objectContaining({
        workLogs: [
          expect.objectContaining({
            workedAt: '2026-03-24T00:00:00.000Z',
            createdAt: '2026-03-24T01:00:00.000Z',
          }),
        ],
      }),
    );
  });

  it('hydrates work-log timestamps from the route payload back into Date instances', () => {
    const hydrated = hydrateEditableBoardTask({
      ...buildEditableTask(),
      workLogs: [
        {
          id: 'log-1',
          title: 'Updated task',
          detail: 'detail',
          engine: null,
          workedAt: '2026-03-24T00:00:00.000Z',
          createdAt: '2026-03-24T01:00:00.000Z',
          todo: { engine: null },
        },
      ],
    });

    expect(hydrated.workLogs[0]?.workedAt).toBeInstanceOf(Date);
    expect(hydrated.workLogs[0]?.createdAt).toBeInstanceOf(Date);
    expect(hydrated.workLogs[0]?.workedAt.toISOString()).toBe('2026-03-24T00:00:00.000Z');
    expect(hydrated.workLogs[0]?.createdAt.toISOString()).toBe('2026-03-24T01:00:00.000Z');
  });
});
