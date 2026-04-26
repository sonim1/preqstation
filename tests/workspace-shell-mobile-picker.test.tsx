// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usePathnameMock = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  prefetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  function MockMenu({ children }: { children: React.ReactNode }) {
    return <div data-menu="true">{children}</div>;
  }

  MockMenu.Target = function MockMenuTarget({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
  MockMenu.Dropdown = function MockMenuDropdown({ children }: { children: React.ReactNode }) {
    return <div data-menu-dropdown="true">{children}</div>;
  };
  MockMenu.Item = function MockMenuItem({
    children,
    leftSection,
    rightSection,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
  }) {
    return (
      <button type="button" {...props}>
        {leftSection}
        {children}
        {rightSection}
      </button>
    );
  };
  MockMenu.Label = function MockMenuLabel({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  };
  MockMenu.Divider = function MockMenuDivider() {
    return <hr />;
  };

  return {
    ...actual,
    Menu: MockMenu as unknown as typeof actual.Menu,
  };
});

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority: _priority,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; src: string }) =>
    React.createElement('img', { alt, src, ...props }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => React.createElement('a', { href, ...props }, children),
}));

vi.mock('next/font/google', () => ({
  Outfit: () => ({
    className: 'font-outfit',
    style: { fontFamily: 'Outfit, sans-serif' },
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => router,
}));

vi.mock('@/app/components/command-palette-trigger', () => ({
  COMMAND_PALETTE_OPEN_EVENT: 'pm:command-palette:open',
  CommandPaletteTrigger: ({
    onOpen,
    variant = 'full',
  }: {
    onOpen?: () => void;
    variant?: 'compact' | 'full';
  }) => (
    <button type="button" data-command-palette-trigger={variant} onClick={onOpen}>
      Search
    </button>
  ),
}));

vi.mock('@/app/components/task-notification-center', () => ({
  TaskNotificationCenter: () => null,
}));

import { WorkspaceShell } from '@/app/components/workspace-shell';
import { LAST_PROJECT_KEY_STORAGE, type WorkspaceProjectOption } from '@/lib/workspace-project-picker';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const projectOptions: WorkspaceProjectOption[] = [
  { id: 'project-1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
  { id: 'project-2', name: 'Beta', projectKey: 'BETA', status: 'paused' },
];

describe('app/components/workspace-shell mobile board picker', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    usePathnameMock.mockReturnValue('/board/ALPHA');
    router.prefetch.mockReset();
    router.push.mockReset();
    router.replace.mockReset();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: '',
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    });
    localStorage = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    localStorage.setItem(LAST_PROJECT_KEY_STORAGE, 'ALPHA');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('clears the remembered project and routes back to the unscoped board when all projects is selected', () => {
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem');

    render(
      <MantineProvider>
        <WorkspaceShell
          email="owner@example.com"
          projectOptions={projectOptions}
          dashboardHref="/dashboard"
          projectsHref="/projects"
          kanbanHref="/board"
          settingsHref="/settings"
          apiKeysHref="/connections"
          signOutControl={<button type="button">Sign out</button>}
        >
          <div>content</div>
        </WorkspaceShell>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: allProjectsLabel }));

    expect(removeItemSpy).toHaveBeenCalledWith(LAST_PROJECT_KEY_STORAGE);
    expect(router.push).toHaveBeenCalledWith('/board');
  });
});

const allProjectsLabel = ['All', 'Projects'].join(' ');
