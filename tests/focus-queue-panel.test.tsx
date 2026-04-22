import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    fullWidth: _fullWidth,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    hide: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => null,
  IconPencil: () => null,
  IconSun: () => null,
  IconTargetArrow: () => null,
  IconChevronsUp: () => null,
  IconChevronUp: () => null,
  IconMinus: () => null,
  IconChevronDown: () => null,
  IconChevronsDown: () => null,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/app/components/link-button', () => ({
  LinkButton: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/components/terminology-provider', () => ({
  useTerminology: () => ({
    agents: { pluralLower: 'agents' },
    statuses: { done: 'Done' },
    task: {
      pluralLower: 'tasks',
      singular: 'Task',
      singularLower: 'task',
    },
  }),
}));

vi.mock('@/lib/task-meta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/task-meta')>();
  return { ...actual };
});

vi.mock('@/lib/terminology', () => ({
  getBoardStatusLabel: () => 'Done',
}));

import { FocusQueuePanel } from '@/app/components/panels/focus-queue-panel';

function makeTodo(index: number) {
  return {
    id: `todo-${index}`,
    taskKey: `TASK-${index}`,
    title: `Task ${index}`,
    taskPriority: 'medium',
    status: 'todo',
    focusedAt: null,
    project: { name: 'Project One' },
    labels: [],
  };
}

describe('app/components/panels/focus-queue-panel', () => {
  it('renders compact metadata and preserves accessible names for compact actions', () => {
    const html = renderToStaticMarkup(
      <FocusQueuePanel
        focusTodos={[
          {
            ...makeTodo(1),
            labels: [
              { id: 'label-1', name: 'Bug', color: 'red' },
              { id: 'label-2', name: 'Client', color: 'blue' },
            ],
          },
        ]}
        updateTodoStatusAction={vi.fn(async () => undefined)}
        toggleTodayFocusAction={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain('Project One');
    expect(html).toContain('2 labels');
    expect(html).not.toContain('>Bug<');
    expect(html).not.toContain('>Client<');
    expect(html).not.toContain('>Done<');
    expect(html).not.toContain('>Edit Task<');
    expect(html).toContain('aria-label="Complete TASK-1');
    expect(html).toContain('aria-label="Add TASK-1');
    expect(html).toContain('aria-label="Edit TASK-1');
  });

  it('renders only the first six todos before expansion', () => {
    const html = renderToStaticMarkup(
      <FocusQueuePanel
        focusTodos={Array.from({ length: 7 }, (_, index) => makeTodo(index + 1))}
        updateTodoStatusAction={vi.fn(async () => undefined)}
        toggleTodayFocusAction={vi.fn(async () => undefined)}
      />,
    );

    expect(html).toContain('TASK-1 · Task 1');
    expect(html).toContain('TASK-6 · Task 6');
    expect(html).not.toContain('TASK-7 · Task 7');
    expect(html).toContain('Show more');
  });

  it('omits the show more control when six or fewer todos are available', () => {
    const html = renderToStaticMarkup(
      <FocusQueuePanel
        focusTodos={Array.from({ length: 6 }, (_, index) => makeTodo(index + 1))}
        updateTodoStatusAction={vi.fn(async () => undefined)}
        toggleTodayFocusAction={vi.fn(async () => undefined)}
      />,
    );

    expect(html).not.toContain('Show more');
  });
});
