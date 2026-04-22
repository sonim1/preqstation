export type BoardTaskPanelLocation = {
  activePanel: 'task-edit' | null;
  taskKey: string | null;
};

export function buildBoardTaskEditHref(editHrefBase: string, taskKey: string) {
  const joiner = editHrefBase.includes('?') ? '&' : '?';
  return `${editHrefBase}${joiner}taskId=${encodeURIComponent(taskKey)}`;
}

export function resolveBoardTaskPanelLocation(href: string): BoardTaskPanelLocation {
  const url = new URL(href, 'http://localhost');
  const activePanel = url.searchParams.get('panel') === 'task-edit' ? 'task-edit' : null;
  const taskKey = activePanel === 'task-edit' ? url.searchParams.get('taskId') || null : null;

  return {
    activePanel,
    taskKey,
  };
}
