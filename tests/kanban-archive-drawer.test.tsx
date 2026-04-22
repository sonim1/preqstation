import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mantine/core', () => {
  const Drawer = ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <section data-testid="drawer">
      <header>{title}</header>
      <div>{children}</div>
    </section>
  );

  const Group = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Stack = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Text = ({ children }: { children: ReactNode }) => <span>{children}</span>;
  const Badge = ({ children }: { children: ReactNode }) => <span>{children}</span>;
  const ActionIcon = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const TextInput = ({
    label,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) => (
    <label>
      {label ? <span>{label}</span> : null}
      <input {...props} />
    </label>
  );
  const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  );

  const MenuRoot = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const MenuTarget = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const MenuDropdown = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const MenuItem = ({
    children,
    leftSection,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { leftSection?: ReactNode }) => (
    <button type="button" {...props}>
      {leftSection}
      {children}
    </button>
  );

  return {
    ActionIcon,
    Badge,
    Button,
    Drawer,
    Group,
    Menu: Object.assign(MenuRoot, {
      Target: MenuTarget,
      Dropdown: MenuDropdown,
      Item: MenuItem,
    }),
    Stack,
    Text,
    TextInput,
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconArchive: () => <svg aria-hidden="true" />,
  IconArrowBackUp: () => <svg aria-hidden="true" />,
  IconDots: () => <svg aria-hidden="true" />,
  IconTrash: () => <svg aria-hidden="true" />,
  IconChevronsUp: () => null,
  IconChevronUp: () => null,
  IconMinus: () => null,
  IconChevronDown: () => null,
  IconChevronsDown: () => null,
}));

vi.mock('@/app/components/empty-state', () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
    icon?: ReactNode;
  }) => (
    <div data-empty-state="true">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/app/components/infinite-scroll-trigger', () => ({
  InfiniteScrollTrigger: ({
    active,
    disabled,
    loading,
    resetKey,
    showManualFallback,
  }: {
    active?: boolean;
    disabled?: boolean;
    loading?: boolean;
    resetKey?: string;
    showManualFallback?: boolean;
  }) => (
    <div
      data-infinite-scroll-trigger="true"
      data-active={active ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      data-reset-key={resetKey}
      data-manual-fallback={showManualFallback ? 'true' : 'false'}
    />
  ),
}));

import { KanbanArchiveDrawer } from '@/app/components/kanban-archive-drawer';
import type { KanbanTask } from '@/lib/kanban-helpers';

function makeTask(
  overrides: Partial<KanbanTask> & {
    id: string;
    taskKey: string;
    title?: string;
  },
): KanbanTask {
  const { id, taskKey, title = `Archived task ${taskKey}`, ...rest } = overrides;

  return {
    id,
    taskKey,
    branch: null,
    title,
    note: null,
    status: 'archived',
    sortOrder: 'a0',
    taskPriority: 'none',
    dueAt: null,
    engine: null,
    runState: null,
    runStateUpdatedAt: null,
    project: null,
    updatedAt: new Date('2026-03-10T00:00:00.000Z').toISOString(),
    archivedAt: new Date('2026-03-10T00:00:00.000Z').toISOString(),
    labels: [],
    ...rest,
  };
}

describe('app/components/kanban-archive-drawer', () => {
  it('renders network-backed archived rows with total metadata and an infinite scroll trigger', () => {
    const tasks = Array.from({ length: 30 }, (_, index) =>
      makeTask({
        id: `task-${index + 1}`,
        taskKey: `ARCH-${index + 1}`,
        title: `Archived task ${index + 1}`,
        archivedAt: index === 0 ? '2026-03-10T15:45:00.000Z' : '2026-03-10T00:00:00.000Z',
      }),
    );

    const html = renderToStaticMarkup(
      <KanbanArchiveDrawer
        opened={true}
        onClose={vi.fn()}
        tasks={tasks}
        total={42}
        query=""
        isLoading={false}
        isLoadingMore={false}
        hasMore={true}
        nextOffset={30}
        isPending={false}
        onQueryChange={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        loadMoreError={null}
      />,
    );

    expect(html).toContain('Archived Tasks');
    expect(html).toContain('42');
    expect(html).toContain('placeholder="Search archived tasks"');
    expect(html).toContain('Showing 30 of 42');
    expect(html).toContain('Archived task 1');
    expect(html).toContain('data-infinite-scroll-trigger="true"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('data-disabled="false"');
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('data-reset-key=":30"');
    expect(html).toContain('data-manual-fallback="false"');
    expect(html).toContain('2026-03-10 15:45');
  });

  it('renders a loading state before the first archived page resolves', () => {
    const html = renderToStaticMarkup(
      <KanbanArchiveDrawer
        opened={true}
        onClose={vi.fn()}
        tasks={[]}
        total={12}
        query=""
        isLoading={true}
        isLoadingMore={false}
        hasMore={false}
        nextOffset={0}
        isPending={false}
        onQueryChange={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        loadMoreError={null}
      />,
    );

    expect(html).toContain('Loading archived tasks');
    expect(html).not.toContain('No archived tasks');
  });

  it('renders distinct empty states for blank and searched archived results', () => {
    const emptyHtml = renderToStaticMarkup(
      <KanbanArchiveDrawer
        opened={true}
        onClose={vi.fn()}
        tasks={[]}
        total={0}
        query=""
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        nextOffset={0}
        isPending={false}
        onQueryChange={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        loadMoreError={null}
      />,
    );
    const searchEmptyHtml = renderToStaticMarkup(
      <KanbanArchiveDrawer
        opened={true}
        onClose={vi.fn()}
        tasks={[]}
        total={0}
        query="ops"
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        nextOffset={0}
        isPending={false}
        onQueryChange={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        loadMoreError={null}
      />,
    );

    expect(emptyHtml).toContain('No archived tasks');
    expect(emptyHtml).toContain('Completed tasks you archive will appear here.');
    expect(searchEmptyHtml).toContain('No matching archived tasks');
    expect(searchEmptyHtml).toContain('Try a different task key, title, note, branch, or label.');
  });

  it('shows retry copy and pauses automatic paging after an archive pagination failure', () => {
    const html = renderToStaticMarkup(
      <KanbanArchiveDrawer
        opened={true}
        onClose={vi.fn()}
        tasks={[makeTask({ id: 'task-1', taskKey: 'ARCH-1' })]}
        total={42}
        query="release"
        isLoading={false}
        isLoadingMore={false}
        hasMore={true}
        nextOffset={30}
        isPending={false}
        onQueryChange={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onLoadMore={vi.fn()}
        loadMoreError="Archived tasks request failed: 500"
      />,
    );

    expect(html).toContain('Archived tasks request failed: 500');
    expect(html).toContain('Use the retry control to keep loading archived tasks.');
    expect(html).toContain('data-manual-fallback="true"');
  });
});
