import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useDisclosureMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn());
const useSyncExternalStoreMock = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  prefetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useSyncExternalStore: useSyncExternalStoreMock,
  };
});

vi.mock('@mantine/hooks', async () => {
  const actual = await vi.importActual<typeof import('@mantine/hooks')>('@mantine/hooks');
  return {
    ...actual,
    useDisclosure: useDisclosureMock,
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

vi.mock('@/app/components/command-palette', () => ({
  CommandPalette: () => null,
  CommandPaletteTrigger: ({ variant = 'full' }: { variant?: 'compact' | 'full' }) => (
    <div data-command-palette-trigger={variant}>Search trigger</div>
  ),
}));

vi.mock('@/app/components/project-picker-menu', () => ({
  ProjectPickerMenuItems: () => null,
}));

vi.mock('@/app/components/task-notification-center', () => ({
  TaskNotificationCenter: () => <div data-task-notification-center="true">Notification center</div>,
}));

import { resolveWorkspaceKanbanHref, WorkspaceShell } from '@/app/components/workspace-shell';
import { type WorkspaceProjectOption } from '@/lib/workspace-project-picker';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const workspaceShellSource = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace-shell.tsx'),
  'utf8',
);

type RenderWorkspaceShellArgs =
  | boolean
  | {
      desktopOpened: boolean;
      pathname?: string;
      projectOptions?: WorkspaceProjectOption[];
      rememberedProjectKey?: string | null;
    };

function renderWorkspaceShell(args: RenderWorkspaceShellArgs) {
  const defaultProjectOptions: WorkspaceProjectOption[] = [
    { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
  ];
  const options =
    typeof args === 'boolean'
      ? {
          desktopOpened: args,
          pathname: '/dashboard',
          projectOptions: defaultProjectOptions,
          rememberedProjectKey: null,
        }
      : {
          pathname: '/dashboard',
          projectOptions: defaultProjectOptions,
          rememberedProjectKey: null,
          ...args,
        };
  useDisclosureMock.mockReset();
  useDisclosureMock
    .mockReturnValueOnce([false, { toggle: vi.fn(), close: vi.fn() }])
    .mockReturnValueOnce([options.desktopOpened, { toggle: vi.fn(), close: vi.fn() }]);
  usePathnameMock.mockReturnValue(options.pathname);
  useSyncExternalStoreMock.mockReturnValue(options.rememberedProjectKey);

  return renderToStaticMarkup(
    <MantineProvider>
      <WorkspaceShell
        email="owner@example.com"
        projectOptions={options.projectOptions}
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
}

describe('app/components/workspace-shell', () => {
  const legacyAllProjectsLabel = ['All', 'Projects'].join(' ');

  it('pins the shared search slot to a symmetric center column in the header grid', () => {
    expect(globalsCss).toContain('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);');
    expect(globalsCss).toContain('justify-self: start;');
    expect(globalsCss).toContain('justify-self: end;');
  });

  it('prefers the remembered project board href when the project still exists', () => {
    expect(
      resolveWorkspaceKanbanHref('/board', 'ALPHA', [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
      ]),
    ).toBe('/board/ALPHA');

    expect(
      resolveWorkspaceKanbanHref('/board', 'MISSING', [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
      ]),
    ).toBe('/board');

    expect(
      resolveWorkspaceKanbanHref('/board', 'PAUSED', [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Paused', projectKey: 'PAUSED', status: 'paused' },
      ]),
    ).toBe('/board');
  });

  it('does not render the color scheme toggle in the header', () => {
    const html = renderWorkspaceShell(true);

    expect(html).not.toContain('Toggle color scheme');
  });

  it('gives the mobile burger button an explicit accessible name while closed', () => {
    const html = renderWorkspaceShell(true);

    expect(html).toContain('aria-label="Open navigation"');
  });

  it('gives the brand link an explicit accessible name when the mobile wordmark is hidden', () => {
    const html = renderWorkspaceShell(true);

    expect(html).toContain('aria-label="Go to dashboard"');
  });

  it('keeps the workspace brand mark on an aspect-ratio-safe render contract', () => {
    const brandMarkSourceMatch = workspaceShellSource.match(
      /<Image[\s\S]*?src="\/brand\/preqstation-app-icon\.svg"[\s\S]*?width=\{(\d+)\}[\s\S]*?height=\{(\d+)\}[\s\S]*?className="workspace-brand-mark"/,
    );
    const brandMarkRule = globalsCss.match(/\.workspace-brand-mark\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(brandMarkSourceMatch).not.toBeNull();
    expect(brandMarkSourceMatch?.[1]).not.toBe(brandMarkSourceMatch?.[2]);
    expect(brandMarkRule).toMatch(/width:\s*auto;/);
    expect(brandMarkRule).toMatch(/height:\s*28px;/);
  });

  it('disables eager workspace route prefetching and marks board links with prefetch={false}', () => {
    expect(workspaceShellSource).not.toContain('router.prefetch(');
    expect(workspaceShellSource).not.toContain('const prefetchRoute =');
    expect(workspaceShellSource).not.toContain('onMouseEnter={() => prefetchRoute(');
    expect(workspaceShellSource).toMatch(/href=\{dashboardHref\}[\s\S]*prefetch=\{false\}/);
    expect(workspaceShellSource).toMatch(
      /href=\{`\/board\/\$\{project\.projectKey\}`\}[\s\S]*prefetch=\{false\}/,
    );
  });

  it('shows the divider rail toggle while the desktop sidebar is open', () => {
    const html = renderWorkspaceShell({ desktopOpened: true });

    expect(html).toContain('workspace-divider-rail');
    expect(html).toContain('Collapse navigation');
    expect(html).not.toContain('workspace-header-sidebar-toggle');
  });

  it('moves the reopen toggle into the header while the desktop sidebar is collapsed', () => {
    const html = renderWorkspaceShell({ desktopOpened: false });

    expect(html).toContain('workspace-header-sidebar-toggle');
    expect(html).toContain('Expand navigation');
    expect(html).not.toContain('workspace-divider-rail');
  });

  it('renders the command palette trigger in the centered header slot instead of the right action group outside board routes', () => {
    const html = renderWorkspaceShell({ desktopOpened: true, pathname: '/dashboard' });
    const middleIndex = html.indexOf('workspace-header-middle');
    const endIndex = html.indexOf('workspace-header-end');
    const avatarIndex = html.indexOf('workspace-avatar-trigger', endIndex);
    const middleHtml = html.slice(middleIndex, endIndex);
    const endHtml = html.slice(endIndex, avatarIndex === -1 ? undefined : avatarIndex);

    expect(middleIndex).toBeGreaterThan(-1);
    expect(middleHtml).toContain('data-command-palette-trigger="full"');
    expect(endHtml).not.toContain('data-command-palette-trigger="full"');
  });

  it('keeps the shared command palette trigger in the centered header slot on board routes', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
    });
    const middleIndex = html.indexOf('workspace-header-middle');
    const endIndex = html.indexOf('workspace-header-end');
    const avatarIndex = html.indexOf('workspace-avatar-trigger', endIndex);
    const middleHtml = html.slice(middleIndex, endIndex);
    const endHtml = html.slice(endIndex, avatarIndex === -1 ? undefined : avatarIndex);

    expect(middleIndex).toBeGreaterThan(-1);
    expect(middleHtml).toContain('data-command-palette-trigger="full"');
    expect(html).not.toContain('placeholder="Search tasks"');
    expect(endHtml).not.toContain('data-command-palette-trigger="full"');
  });

  it('keeps the mobile project picker in the middle slot and places the compact search trigger before the avatar', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
    });
    const middleIndex = html.indexOf('workspace-header-middle');
    const endIndex = html.indexOf('workspace-header-end');
    const middleHtml = html.slice(middleIndex, endIndex);
    const compactTriggerIndex = html.indexOf('data-command-palette-trigger="compact"', endIndex);
    const avatarIndex = html.indexOf('workspace-avatar-trigger', endIndex);

    expect(middleIndex).toBeGreaterThan(-1);
    expect(middleHtml).toContain('workspace-mobile-project-picker');
    expect(middleHtml).not.toContain('data-command-palette-trigger="compact"');
    expect(compactTriggerIndex).toBeGreaterThan(endIndex);
    expect(avatarIndex).toBeGreaterThan(compactTriggerIndex);
  });

  it('renders the notification center in the right action group before the avatar menu', () => {
    const html = renderWorkspaceShell({ desktopOpened: true, pathname: '/dashboard' });
    const endIndex = html.indexOf('workspace-header-end');
    const notificationIndex = html.indexOf('data-task-notification-center="true"', endIndex);
    const avatarIndex = html.indexOf('workspace-avatar-trigger', endIndex);

    expect(notificationIndex).toBeGreaterThan(endIndex);
    expect(avatarIndex).toBeGreaterThan(notificationIndex);
  });

  it('centers the mobile project picker menu and its arrow under the trigger', () => {
    const mobileProjectPickerMatch = workspaceShellSource.match(
      /const mobileProjectPicker = \(([\s\S]*?)\n  \);\n\n  return \(/,
    );

    expect(mobileProjectPickerMatch).not.toBeNull();
    const mobileProjectPickerSource = mobileProjectPickerMatch?.[1] ?? '';

    expect(mobileProjectPickerSource).toContain('position="bottom"');
    expect(mobileProjectPickerSource).toContain('arrowPosition="center"');
    expect(mobileProjectPickerSource).not.toContain('position="bottom-end"');
    expect(mobileProjectPickerSource).not.toContain('workspace-project-picker-icon-wrap');
    expect(mobileProjectPickerSource).not.toContain('IconFolders');
  });

  it('renders boards beneath the boards nav entry on desktop', () => {
    const html = renderWorkspaceShell({ desktopOpened: true });
    const navHtml = html.slice(html.indexOf('workspace-navbar'));
    const dashboardIndex = navHtml.indexOf('Dashboard');
    const projectsIndex = navHtml.indexOf('Projects');
    const boardIndex = navHtml.indexOf('Boards');
    const alphaIndex = navHtml.indexOf('Alpha');

    expect(dashboardIndex).toBeGreaterThan(-1);
    expect(projectsIndex).toBeGreaterThan(dashboardIndex);
    expect(boardIndex).toBeGreaterThan(projectsIndex);
    expect(alphaIndex).toBeGreaterThan(boardIndex);
  });

  it('renders only active boards in the desktop board list', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
      projectOptions: [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Beta', projectKey: 'BETA', status: 'paused' },
        { id: '3', name: 'Gamma', projectKey: 'GAMMA', status: 'active' },
        { id: '4', name: 'Delta', projectKey: 'DELTA', status: 'done' },
      ],
    });

    expect(html).not.toContain('>Paused<');
    expect(html).not.toContain('href="/board/BETA"');
    expect(html).not.toContain('href="/board/DELTA"');
    expect(html).toMatch(
      /href="\/board\/ALPHA"[\s\S]*workspace-board-subnav-link[\s\S]*href="\/board\/GAMMA"[\s\S]*workspace-board-subnav-link/,
    );
  });

  it('renders a connections nav link instead of api keys', () => {
    const html = renderWorkspaceShell({ desktopOpened: true });

    expect(html).toContain('href="/connections"');
    expect(html).toContain('Connections');
    expect(html).not.toContain('API Keys');
  });

  it('marks the active top-level nav link with aria-current for assistive technology', () => {
    const html = renderWorkspaceShell({ desktopOpened: true, pathname: '/connections' });

    expect(html).toMatch(/href="\/connections"[\s\S]*aria-current="page"/);
  });

  it('does not render an unread count badge beside the Boards nav label', () => {
    const html = renderWorkspaceShell({ desktopOpened: true });

    expect(html).not.toContain('mantine-Badge-root');
  });

  it('defaults the mobile picker to the remembered project on dashboard routes', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/dashboard',
      rememberedProjectKey: 'ALPHA',
    });

    expect(html).toContain('aria-label="Project picker. Current: Alpha"');
    expect(html).toContain('>Alpha<');
    expect(html).not.toContain(`>${legacyAllProjectsLabel}<`);
  });

  it('falls back to a neutral boards label when no project is remembered', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/dashboard',
      rememberedProjectKey: null,
    });

    expect(html).toContain('aria-label="Project picker. Current: Boards"');
    expect(html).toContain('>Boards<');
  });

  it('surfaces the current project name in the mobile picker on project routes', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/project/ALPHA',
      rememberedProjectKey: 'ALPHA',
    });

    expect(html).toContain('aria-label="Project picker. Current: Alpha"');
    expect(html).toContain('>Alpha<');
  });

  it('marks the current board as a nested selector without a second active nav state', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
    });

    expect(html).toContain('data-current-board="true"');
    expect(html).toContain('Boards');
  });

  it('renders nested board rows as links and marks the current board with aria-current', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/BETA',
      rememberedProjectKey: 'BETA',
      projectOptions: [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Beta', projectKey: 'BETA', status: 'active' },
      ],
    });

    expect(html).toMatch(
      /href="\/board\/ALPHA"[\s\S]*workspace-board-subnav-link[\s\S]*href="\/board\/BETA"[\s\S]*workspace-board-subnav-link/,
    );
    expect(html).toMatch(
      /href="\/board\/BETA"[\s\S]*workspace-board-subnav-link[\s\S]*aria-current="page"/,
    );
  });

  it('renders a sliding board selection surface with a fixed row offset', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/BETA',
      rememberedProjectKey: 'BETA',
      projectOptions: [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Beta', projectKey: 'BETA', status: 'active' },
        { id: '3', name: 'Gamma', projectKey: 'GAMMA', status: 'active' },
      ],
    });

    expect(html).toContain('workspace-board-subnav-surface');
    expect(html).toContain('data-current-board-index="1"');
    expect(html).toContain('transform:translateY(48px)');
    expect(html).not.toContain('workspace-board-subnav-pulse');
  });

  it('keeps the board selection surface hidden when no board is selected', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/dashboard',
      rememberedProjectKey: 'ALPHA',
      projectOptions: [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Beta', projectKey: 'BETA', status: 'active' },
      ],
    });

    expect(html).toContain('data-current-board-index="-1"');
    expect(html).toContain('opacity:0');
    expect(html).not.toContain('data-current-board="true"');
  });

  it('keeps paused current boards out of the desktop board list while leaving the active selection surface hidden', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/BETA',
      rememberedProjectKey: 'BETA',
      projectOptions: [
        { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
        { id: '2', name: 'Beta', projectKey: 'BETA', status: 'paused' },
        { id: '3', name: 'Gamma', projectKey: 'GAMMA', status: 'active' },
      ],
    });

    expect(html).not.toContain('>Paused<');
    expect(html).not.toContain('href="/board/BETA"');
    expect(html).toContain('href="/board/ALPHA"');
    expect(html).toContain('href="/board/GAMMA"');
    expect(html).toContain('data-current-board-index="-1"');
    expect(html).toContain('opacity:0');
  });

  it('matches the nested board row height to the larger selection surface by removing vertical padding', () => {
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-link\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*0 12px;/,
    );
  });

  it('keeps Mantine root hover and current backgrounds transparent for nested board rows', () => {
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-link:hover,\s*\.workspace-board-subnav-link\[data-active\],\s*\.workspace-board-subnav-link\[data-active\]:hover,\s*\.workspace-board-subnav-link\[aria-current='page'\],\s*\.workspace-board-subnav-link\[aria-current='page'\]:hover\s*\{[\s\S]*background:\s*transparent;[\s\S]*background-color:\s*transparent;/,
    );
  });

  it('defines an in-bounds focus treatment for nested board links', () => {
    const nestedBoardFocusRule =
      globalsCss.match(/\.workspace-board-subnav-link:focus-visible\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const nestedBoardBodyFocusRule =
      globalsCss.match(
        /\.workspace-board-subnav-link:focus-visible\s+\.mantine-NavLink-body\s*\{([\s\S]*?)\}/,
      )?.[1] ?? '';

    expect(nestedBoardFocusRule).toMatch(/outline:\s*none;/);
    expect(nestedBoardFocusRule).toMatch(/color:\s*var\(--ui-text\);/);
    expect(nestedBoardFocusRule).toMatch(/background:\s*var\(--ui-accent-soft\);/);
    expect(nestedBoardFocusRule).toMatch(/box-shadow:/);
    expect(nestedBoardBodyFocusRule).toBe('');
  });

  it('defines a custom focus-visible treatment for top-level workspace nav links', () => {
    expect(globalsCss).toMatch(
      /\.workspace-nav-link:not\(\.workspace-board-subnav-link\):focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*background:\s*var\(--ui-accent-soft\);[\s\S]*color:\s*var\(--ui-text\);[\s\S]*box-shadow:/,
    );
    expect(globalsCss).not.toMatch(/\.workspace-nav-link:focus-visible\s*\{/);
  });

  it('defines a shared focus-visible treatment for header and rail controls', () => {
    expect(globalsCss).toMatch(
      /\.workspace-brand-link:focus-visible,\s*\.workspace-divider-rail-button:focus-visible,\s*\.workspace-header-sidebar-toggle:focus-visible,\s*\.workspace-avatar-trigger:focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*border-color:\s*var\(--ui-accent\);[\s\S]*box-shadow:/,
    );
  });

  it('reduces the nested board list inset and removes the selected pulse decoration', () => {
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav\s*\{[^}]*margin-left:\s*8px;[^}]*padding:\s*2px;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-surface\s*\{[^}]*top:\s*2px;[^}]*left:\s*2px;[^}]*right:\s*2px;/,
    );
    expect(globalsCss).not.toContain('.workspace-board-subnav-pulse');
  });

  it('uses flatter token-based sidebar chrome instead of blur-heavy gradients', () => {
    expect(globalsCss).not.toMatch(/\.workspace-navbar\s*\{[^}]*backdrop-filter:/);
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-surface\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--ui-accent-soft\), var\(--ui-surface-strong\) 42%\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-nav-link\[data-active='true'\]\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--ui-accent-soft\), var\(--ui-surface-strong\) 34%\);[^}]*color:\s*var\(--ui-text\);/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme='dark'\] \.workspace-nav-link\[data-active='true'\]\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--ui-accent-soft\), var\(--ui-surface-strong\) 26%\);[^}]*color:\s*var\(--ui-text\);/,
    );
  });

  it('keeps the header and account menu on flat surfaces instead of blur-heavy chrome', () => {
    expect(globalsCss).not.toMatch(/\.workspace-header\s*\{[^}]*backdrop-filter:/);
    expect(globalsCss).not.toMatch(/\.workspace-user-menu\s*\{[^}]*backdrop-filter:/);
    expect(globalsCss).toMatch(/\.workspace-header\s*\{[^}]*background:\s*var\(--ui-surface\);/);
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme='dark'\] \.workspace-user-menu\s*\{[^}]*background:\s*var\(--ui-surface-strong\);/,
    );
  });

  it('keeps the left header chrome on token-driven dark surfaces', () => {
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme='dark'\] \.workspace-brand-link,\s*html\[data-mantine-color-scheme='dark'\] \.workspace-avatar-trigger\s*\{[^}]*background:\s*var\(--ui-surface-soft\);/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme='dark'\] \.workspace-mobile-project-picker\s*\{[^}]*border-color:\s*color-mix\(in srgb,\s*var\(--ui-border\),\s*var\(--ui-accent\)\s*24%\);[^}]*background:\s*var\(--ui-surface-soft\);/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme='dark'\] \.workspace-mobile-project-picker:hover,\s*html\[data-mantine-color-scheme='dark'\] \.workspace-mobile-project-picker:focus-visible\s*\{[^}]*border-color:\s*color-mix\(in srgb,\s*var\(--ui-accent\),\s*var\(--ui-border\)\s*40%\);[^}]*background:\s*color-mix\(in srgb,\s*var\(--ui-accent-soft\),\s*var\(--ui-surface-soft\)\s*70%\);/,
    );
  });

  it('moves header edge padding into css so mobile can remove it cleanly', () => {
    const headerSource =
      workspaceShellSource.match(
        /<AppShell\.Header className="workspace-header">([\s\S]*?)<\/AppShell\.Header>/,
      )?.[1] ?? '';

    expect(headerSource).not.toContain('px="md"');
    expect(globalsCss).toMatch(
      /\.workspace-header-inner\s*\{[^}]*padding-inline:\s*var\(--mantine-spacing-md\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-header-inner\s*\{[\s\S]*padding-inline:\s*0;/,
    );
  });

  it('renders the mobile account block below connections in the navbar', () => {
    const html = renderWorkspaceShell({ desktopOpened: true, pathname: '/dashboard' });
    const navHtml = html.slice(html.indexOf('workspace-navbar'));
    const connectionsIndex = navHtml.indexOf('Connections');
    const mobileAccountIndex = navHtml.indexOf('workspace-mobile-account');

    expect(html).toContain('workspace-mobile-account-shell');
    expect(html).toContain('workspace-mobile-account');
    expect(html).toContain('>Account<');
    expect(html).toContain('owner@example.com');
    expect(connectionsIndex).toBeGreaterThan(-1);
    expect(mobileAccountIndex).toBeGreaterThan(connectionsIndex);
  });

  it('keeps the desktop avatar menu desktop-only in source and reuses the mobile account block in the drawer', () => {
    expect(workspaceShellSource).toMatch(
      /<Box visibleFrom="sm">[\s\S]*workspace-avatar-trigger[\s\S]*workspace-user-menu[\s\S]*<\/Box>/,
    );
    expect(workspaceShellSource).toMatch(
      /const mobileAccountBlock = \([\s\S]*<Box hiddenFrom="sm" className="workspace-mobile-account-shell">[\s\S]*workspace-mobile-account[\s\S]*workspace-mobile-account-email[\s\S]*signOutControl[\s\S]*\);/,
    );
    expect(workspaceShellSource).toMatch(/label="Connections"[\s\S]*\{mobileAccountBlock\}/);
  });

  it('centers the mobile burger control inside its touch target', () => {
    const burgerRule =
      globalsCss.match(/\.workspace-header-start \.mantine-Burger-root\s*\{([\s\S]*?)\}/)?.[1] ??
      '';

    expect(burgerRule).toMatch(/display:\s*flex;/);
    expect(burgerRule).toMatch(/align-items:\s*center;/);
    expect(burgerRule).toMatch(/justify-content:\s*center;/);
  });

  it('keeps the mobile account block below connections without a divider line', () => {
    const mobileAccountShellRule =
      globalsCss.match(/\.workspace-mobile-account-shell\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(mobileAccountShellRule).toMatch(/padding:\s*8px 10px 4px;/);
    expect(mobileAccountShellRule).not.toMatch(/border-top:/);
  });

  it('makes the mobile header and navbar opaque and styles the drawer account block for touch', () => {
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-header,\s*[\s\S]*\.workspace-navbar\s*\{[\s\S]*background:\s*var\(--ui-surface-strong\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-navbar\s*\{[\s\S]*box-shadow:\s*18px 0 32px -24px rgba\(20,\s*44,\s*84,\s*0\.45\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*html\[data-mantine-color-scheme='dark'\] \.workspace-header,\s*[\s\S]*html\[data-mantine-color-scheme='dark'\] \.workspace-navbar\s*\{[\s\S]*background:\s*var\(--ui-surface-strong\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-account\s*\{[^}]*background:\s*var\(--ui-surface-soft\);[^}]*padding:\s*10px;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-account-email\s*\{[^}]*overflow-wrap:\s*anywhere;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-account \.workspace-signout-btn\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*var\(--ui-hit-touch-min\);[^}]*justify-content:\s*flex-start;[^}]*margin-top:\s*8px;/,
    );
  });

  it('removes the unused legacy desktop project picker root styles', () => {
    expect(globalsCss).not.toMatch(/\.workspace-project-picker\s*\{/);
    expect(globalsCss).not.toContain('.workspace-project-picker:hover');
    expect(globalsCss).not.toContain('.workspace-project-picker:focus-visible');
  });

  it('centers the compact project picker and keeps the compact trigger styling scoped to its modifier', () => {
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-brand-copy\s*\{[\s\S]*display:\s*none;/,
    );
    expect(globalsCss).toMatch(
      /\.command-palette-trigger--compact\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*width:\s*var\(--ui-hit-touch-min\);[^}]*min-width:\s*var\(--ui-hit-touch-min\);[^}]*justify-content:\s*center;/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-header-middle\s*\{[\s\S]*justify-content:\s*center;/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-mobile-project-picker\s*\{[\s\S]*margin:\s*0 auto;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-project-picker\s*\{[^}]*min-height:\s*var\(--ui-hit-touch-min\);/,
    );
  });

  it('gives the mobile project picker more room for long project names', () => {
    expect(globalsCss).toMatch(
      /\.workspace-mobile-project-picker\s*\{[^}]*max-width:\s*min\(60vw, 260px\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-project-picker-label\s*\{[^}]*max-width:\s*min\(38vw, 168px\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*\.workspace-mobile-project-picker\s*\{[\s\S]*max-width:\s*min\(64vw, 260px\);/,
    );
  });
});
