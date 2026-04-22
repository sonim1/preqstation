import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskStatusBar } from '@/app/components/task-status-bar';
import { TerminologyProvider } from '@/app/components/terminology-provider';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';

function renderTaskStatusBar(tasks: Array<{ status: string }>) {
  return renderToStaticMarkup(
    <MantineProvider>
      <TerminologyProvider terminology={DEFAULT_TERMINOLOGY}>
        <TaskStatusBar
          tasks={tasks}
          boardHref="/board/PROJ"
          newTaskHref="/dashboard?panel=task&projectId=1"
        />
      </TerminologyProvider>
    </MantineProvider>,
  );
}

describe('app/components/task-status-bar', () => {
  it('renders a human-readable task distribution summary and explicit status labels', () => {
    const html = renderTaskStatusBar([
      { status: 'todo' },
      { status: 'ready' },
      { status: 'done' },
      { status: 'done' },
      { status: 'archived' },
    ]);

    expect(html).toContain('5 tasks total: 1 Todo, 1 Ready, 2 Done, 1 Archived.');
    expect(html).toContain('3 complete (60%).');
    expect(html).toContain('aria-label="Todo: 1 of 5 tasks (20%)"');
    expect(html).toContain('aria-valuetext="1 of 5 tasks (20%)"');
    expect(html).toContain('aria-label="Ready: 1 of 5 tasks (20%)"');
    expect(html).toContain('aria-label="Done: 2 of 5 tasks (40%)"');
    expect(html).toContain('aria-label="Archived: 1 of 5 tasks (20%)"');
  });
});
