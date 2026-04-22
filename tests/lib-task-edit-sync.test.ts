import { describe, expect, it } from 'vitest';

import {
  buildTaskEditFieldRevisions,
  buildTaskEditRevision,
  shouldHydrateTaskEditRevision,
} from '@/lib/task-edit-sync';

function buildEditableTodo(
  overrides: Partial<{
    taskKey: string;
    title: string;
    note: string | null;
    labelIds: string[];
    taskPriority: string;
    runState: 'queued' | 'running' | null;
  }> = {},
) {
  return {
    taskKey: 'PROJ-189',
    title: 'Status sync bug',
    note: 'before',
    labelIds: [],
    taskPriority: 'none',
    runState: null,
    ...overrides,
  };
}

describe('lib/task-edit-sync', () => {
  it('builds a stable revision from the editable task fields', () => {
    const revision = buildTaskEditRevision(
      buildEditableTodo({
        title: 'Updated title',
        note: 'Updated body',
        labelIds: ['label-1'],
        taskPriority: 'high',
        runState: 'queued',
      }),
    );

    expect(revision).toBe(
      JSON.stringify([
        ['taskKey', 'PROJ-189'],
        ['title', 'Updated title'],
        ['note', 'Updated body'],
        ['labelIds', 'label-1'],
        ['taskPriority', 'high'],
        ['runState', 'queued'],
      ]),
    );
  });

  it('refuses to hydrate a new task revision while local edits are still dirty', () => {
    const previousRevision = buildTaskEditRevision(buildEditableTodo());
    const nextRevision = buildTaskEditRevision(
      buildEditableTodo({
        title: 'Saved on server',
      }),
    );

    expect(
      shouldHydrateTaskEditRevision({
        previousRevision,
        nextRevision,
        isDirty: true,
      }),
    ).toBe(false);
  });

  it('hydrates a new task revision once the local form is clean', () => {
    const previousRevision = buildTaskEditRevision(buildEditableTodo());
    const nextRevision = buildTaskEditRevision(
      buildEditableTodo({
        title: 'Saved on server',
      }),
    );

    expect(
      shouldHydrateTaskEditRevision({
        previousRevision,
        nextRevision,
        isDirty: false,
      }),
    ).toBe(true);
  });

  it('keeps the note revision stable when only the title changes', () => {
    const previousRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const nextRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        title: 'Saved on server',
      }),
    );

    expect(nextRevisions.note).toBe(previousRevisions.note);
    expect(nextRevisions.title).not.toBe(previousRevisions.title);
  });

  it('keeps the note revision stable when only the labels change', () => {
    const previousRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const nextRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        labelIds: ['label-1'],
      }),
    );

    expect(nextRevisions.note).toBe(previousRevisions.note);
    expect(nextRevisions.labels).not.toBe(previousRevisions.labels);
  });

  it('invalidates the note revision when the note content changes', () => {
    const previousRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const nextRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        note: 'Saved note',
      }),
    );

    expect(nextRevisions.note).not.toBe(previousRevisions.note);
  });

  it('invalidates every field revision when the task identity changes', () => {
    const previousRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const nextRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        taskKey: 'PROJ-190',
      }),
    );

    expect(nextRevisions.title).not.toBe(previousRevisions.title);
    expect(nextRevisions.note).not.toBe(previousRevisions.note);
    expect(nextRevisions.labels).not.toBe(previousRevisions.labels);
    expect(nextRevisions.taskPriority).not.toBe(previousRevisions.taskPriority);
    expect(nextRevisions.runState).not.toBe(previousRevisions.runState);
  });
});
