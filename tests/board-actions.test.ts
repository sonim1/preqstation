import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  getTaskLabelIdsFromFormData: vi.fn(() => []),
  redirect: vi.fn(),
  requireOwnerUser: vi.fn(),
  runDeleteTaskAction: vi.fn(),
  runUpdateTaskAction: vi.fn(),
  withOwnerDb: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocked.redirect,
}));

vi.mock('@/lib/actions/task-actions', () => ({
  deleteTask: mocked.runDeleteTaskAction,
  updateTask: mocked.runUpdateTaskAction,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: mocked.withOwnerDb,
}));

vi.mock('@/lib/next-utils', () => ({
  isNextRedirectError: () => false,
}));

vi.mock('@/lib/owner', () => ({
  requireOwnerUser: mocked.requireOwnerUser,
}));

vi.mock('@/lib/task-keys', () => ({
  taskWhereByIdentifier: vi.fn(),
}));

vi.mock('@/lib/task-labels', () => ({
  extractTaskLabels: vi.fn(() => []),
  getTaskLabelIdsFromFormData: mocked.getTaskLabelIdsFromFormData,
}));

import { boardUpdateTask } from '@/lib/actions/board-actions';

describe('lib/actions/board-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireOwnerUser.mockResolvedValue({ id: 'owner-1' });
    mocked.runUpdateTaskAction.mockResolvedValue({
      ok: false,
      message: 'Task notes changed in another session. Reload the latest notes and try again.',
    });
  });

  it('forwards the note base fingerprint when updating a task from the board form', async () => {
    const formData = new FormData();
    formData.set('id', 'PROJ-8');
    formData.set('title', 'Updated from board');
    formData.set('noteMd', 'Local board note');
    formData.set('baseNoteFingerprint', 'task-note:v1:42:deadbeef');
    formData.set('taskPriority', 'none');
    formData.set('runState', '');
    formData.set('projectId', 'project-1');

    const result = await boardUpdateTask(null, formData, '/board');

    expect(mocked.runUpdateTaskAction).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      identifier: 'PROJ-8',
      baseNoteFingerprint: 'task-note:v1:42:deadbeef',
      title: 'Updated from board',
      noteMd: 'Local board note',
      labelIds: [],
      taskPriority: 'none',
      runState: '',
      projectId: 'project-1',
    });
    expect(result).toEqual({
      ok: false,
      message: 'Task notes changed in another session. Reload the latest notes and try again.',
    });
  });

  it('reloads the updated task dispatch target for the returned board snapshot', async () => {
    const formData = new FormData();
    formData.set('id', 'PROJ-8');
    formData.set('title', 'Updated from board');
    formData.set('noteMd', 'Local board note');
    formData.set('baseNoteFingerprint', 'task-note:v1:42:deadbeef');
    formData.set('taskPriority', 'none');
    formData.set('runState', '');
    formData.set('projectId', 'project-1');

    const findFirst = vi.fn().mockResolvedValue({
      id: 'task-1',
      taskKey: 'PROJ-8',
      branch: 'task/proj-8/hermes-dispatch',
      title: 'Updated from board',
      note: 'Local board note',
      projectId: 'project-1',
      taskPriority: 'none',
      status: 'todo',
      engine: 'codex',
      dispatchTarget: 'hermes-telegram',
      runState: null,
      runStateUpdatedAt: null,
      sortOrder: 'a0',
      dueAt: null,
      archivedAt: null,
      updatedAt: new Date('2026-03-10T12:00:00.000Z'),
      project: { id: 'project-1', name: 'Project One', projectKey: 'PROJ' },
      label: null,
      labelAssignments: [],
      workLogs: [],
    });

    mocked.runUpdateTaskAction.mockResolvedValue({
      ok: true,
      data: {
        changed: true,
        taskKey: 'PROJ-8',
        labelId: null,
        labelIds: [],
        taskPriority: 'none',
        changedFields: ['dispatchTarget'],
      },
    });
    mocked.withOwnerDb.mockImplementation(async (_ownerId: string, callback: Function) =>
      callback({
        query: {
          tasks: {
            findFirst,
          },
        },
      }),
    );

    const result = await boardUpdateTask(null, formData, '/board');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.objectContaining({
          dispatchTarget: true,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        boardTask: expect.objectContaining({
          dispatchTarget: 'hermes-telegram',
        }),
      }),
    );
  });
});
