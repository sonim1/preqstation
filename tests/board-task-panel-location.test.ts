import { describe, expect, it } from 'vitest';

import {
  buildBoardTaskEditHref,
  resolveBoardTaskPanelLocation,
} from '@/lib/board-task-panel-location';

describe('lib/board-task-panel-location', () => {
  it('builds a task edit href from a board base url', () => {
    expect(buildBoardTaskEditHref('/board/PROJ?panel=task-edit', 'PROJ-310')).toBe(
      '/board/PROJ?panel=task-edit&taskId=PROJ-310',
    );
    expect(buildBoardTaskEditHref('/board?panel=task-edit', 'PROJ 310/alpha')).toBe(
      '/board?panel=task-edit&taskId=PROJ%20310%2Falpha',
    );
  });

  it('resolves an open task-edit panel from the current location', () => {
    expect(resolveBoardTaskPanelLocation('/board/PROJ?panel=task-edit&taskId=PROJ-310')).toEqual({
      activePanel: 'task-edit',
      taskKey: 'PROJ-310',
    });
  });

  it('treats non task-edit locations as closed', () => {
    expect(resolveBoardTaskPanelLocation('/board/PROJ')).toEqual({
      activePanel: null,
      taskKey: null,
    });
    expect(resolveBoardTaskPanelLocation('/board/PROJ?panel=search&taskId=PROJ-310')).toEqual({
      activePanel: null,
      taskKey: null,
    });
  });
});
