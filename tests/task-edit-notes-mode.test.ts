import { describe, expect, it } from 'vitest';

import {
  applyTaskEditNotesModeChange,
  resolveTaskEditNotesMode,
  type TaskEditNotesModeState,
} from '@/app/components/task-edit-form';
import { buildTaskEditFieldRevisions } from '@/lib/task-edit-sync';

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

describe('app/components/task-edit-form notes mode state', () => {
  it('reuses the current state when the requested mode and revision are unchanged', () => {
    const currentState: TaskEditNotesModeState = {
      mode: 'live',
      revision: 'revision-1',
      taskKey: 'PROJ-189',
    };

    expect(applyTaskEditNotesModeChange(currentState, 'live', 'revision-1', 'PROJ-189')).toBe(
      currentState,
    );
  });

  it('creates a new state when the mode, revision, or task identity changes', () => {
    const currentState: TaskEditNotesModeState = {
      mode: 'live',
      revision: 'revision-1',
      taskKey: 'PROJ-189',
    };

    expect(
      applyTaskEditNotesModeChange(currentState, 'markdown', 'revision-1', 'PROJ-189'),
    ).toEqual({
      mode: 'markdown',
      revision: 'revision-1',
      taskKey: 'PROJ-189',
    });
    expect(applyTaskEditNotesModeChange(currentState, 'live', 'revision-2', 'PROJ-189')).toEqual({
      mode: 'live',
      revision: 'revision-2',
      taskKey: 'PROJ-189',
    });
    expect(applyTaskEditNotesModeChange(currentState, 'live', 'revision-1', 'PROJ-190')).toEqual({
      mode: 'live',
      revision: 'revision-1',
      taskKey: 'PROJ-190',
    });
  });

  it('keeps markdown mode when only title or label revisions change', () => {
    const initialRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const titleRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        title: 'Saved on server',
      }),
    );
    const labelRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        labelIds: ['label-1'],
      }),
    );
    const currentState = applyTaskEditNotesModeChange(
      {
        mode: 'live',
        revision: initialRevisions.note,
        taskKey: 'PROJ-189',
      },
      'markdown',
      initialRevisions.note,
      'PROJ-189',
    );

    expect(titleRevisions.note).toBe(initialRevisions.note);
    expect(labelRevisions.note).toBe(initialRevisions.note);
    expect(resolveTaskEditNotesMode(currentState, 'PROJ-189')).toBe('markdown');
  });

  it('keeps markdown mode when blur autosave rehydrates the same note', () => {
    const initialRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const noteRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        note: 'Saved on server',
      }),
    );
    const currentState = applyTaskEditNotesModeChange(
      {
        mode: 'live',
        revision: initialRevisions.note,
        taskKey: 'PROJ-189',
      },
      'markdown',
      initialRevisions.note,
      'PROJ-189',
    );

    expect(noteRevisions.note).not.toBe(initialRevisions.note);
    expect(resolveTaskEditNotesMode(currentState, 'PROJ-189')).toBe('markdown');
  });

  it('resets to live mode when the task identity changes', () => {
    const initialRevisions = buildTaskEditFieldRevisions(buildEditableTodo());
    const nextTaskRevisions = buildTaskEditFieldRevisions(
      buildEditableTodo({
        taskKey: 'PROJ-190',
      }),
    );
    const currentState = applyTaskEditNotesModeChange(
      {
        mode: 'live',
        revision: initialRevisions.note,
        taskKey: 'PROJ-189',
      },
      'markdown',
      initialRevisions.note,
      'PROJ-189',
    );

    expect(nextTaskRevisions.note).not.toBe(initialRevisions.note);
    expect(resolveTaskEditNotesMode(currentState, 'PROJ-190')).toBe('live');
  });
});
