import { describe, expect, it } from 'vitest';

import {
  type CommandPaletteTaskHit,
  mergeCommandPaletteTaskHits,
} from '@/app/components/command-palette';

function hit(taskKey: string, title = taskKey): CommandPaletteTaskHit {
  return {
    taskId: `task:${taskKey}`,
    taskKey,
    title,
    status: 'todo',
    project: { id: 'project-1', name: 'Alpha', projectKey: 'PROJ' },
  };
}

describe('app/components/command-palette', () => {
  it('keeps local task hits first and dedupes server hits by task key', () => {
    expect(
      mergeCommandPaletteTaskHits(
        [hit('PROJ-1', 'Local title')],
        [hit('PROJ-1', 'Server title'), hit('PROJ-2', 'Server only')],
      ),
    ).toEqual([hit('PROJ-1', 'Local title'), hit('PROJ-2', 'Server only')]);
  });
});
