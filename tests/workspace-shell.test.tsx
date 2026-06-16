// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  CommandPaletteTrigger: ({ variant = 'full' }: { variant?: 'compact' | 'full' }) => {
    const className =
      variant === 'compact'
        ? 'command-palette-trigger command-palette-trigger--compact'
        : 'command-palette-trigger';

    return (
      <button type="button" className={className} data-command-palette-trigger={variant}>
        Search trigger
      </button>
    );
  },
}));

vi.mock('@/app/components/project-picker-menu', () => ({
  ProjectPickerMenuItems: () => null,
}));

vi.mock('@/app/components/task-notification-center', () => ({
  TaskNotificationCenter: () => <div data-task-notification-center="true">Notification center</div>,
}));

import { resolveWorkspaceKanbanHref, WorkspaceShell } from '@/app/components/workspace-shell';
import {
  RECENT_PROJECTS_STORAGE,
  type WorkspaceProjectOption,
} from '@/lib/workspace-project-picker';

afterEach(() => {
  cleanup();
});

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
  const options = prepareWorkspaceShellRender(args);

  return renderToStaticMarkup(workspaceShellElement(options.projectOptions));
}

function renderWorkspaceShellDom(args: RenderWorkspaceShellArgs) {
  const options = prepareWorkspaceShellRender(args);

  ensureBrowserObservers();
  ensureMatchMedia();

  return render(workspaceShellElement(options.projectOptions));
}

function prepareWorkspaceShellRender(args: RenderWorkspaceShellArgs) {
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
  let externalStoreCallIndex = 0;
  useSyncExternalStoreMock.mockImplementation(
    (_subscribe: unknown, _getSnapshot: unknown, getServerSnapshot?: () => unknown) => {
      externalStoreCallIndex += 1;
      if (externalStoreCallIndex === 1) return options.rememberedProjectKey;

      return getServerSnapshot?.();
    },
  );

  return options;
}

function workspaceShellElement(projectOptions: WorkspaceProjectOption[]) {
  return (
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
    </MantineProvider>
  );
}

function ensureMatchMedia() {
  const testWindow = window as Window & { matchMedia?: Window['matchMedia'] };

  if (typeof testWindow.matchMedia === 'function') {
    return;
  }

  Object.defineProperty(testWindow, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ensureBrowserObservers() {
  const testGlobal = globalThis as typeof globalThis & {
    ResizeObserver?: typeof ResizeObserver;
  };

  if (testGlobal.ResizeObserver) {
    return;
  }

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(testGlobal, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverStub,
  });
}

function getWorkspaceNavbar(container: HTMLElement) {
  const navbar = container.querySelector<HTMLElement>('.workspace-navbar');

  expect(navbar).not.toBeNull();

  return navbar as HTMLElement;
}

function expectBefore(first: Element, second: Element) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

function renderWorkspaceCssFixture(markup: string) {
  const style = document.createElement('style');
  const fixture = document.createElement('div');

  style.textContent = globalsCss;
  fixture.innerHTML = markup;
  document.head.append(style);
  document.body.append(fixture);

  return {
    fixture,
    cleanup: () => {
      fixture.remove();
      style.remove();
    },
  };
}

function getRequiredFixtureElement(fixture: HTMLElement, testId: string) {
  const element = fixture.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  expect(element).not.toBeNull();

  return element as HTMLElement;
}

function makeActiveProjectOptions(count: number): WorkspaceProjectOption[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;

    return {
      id: `project-${number}`,
      name: `Project ${number}`,
      projectKey: `PROJECT-${number}`,
      status: 'active',
    };
  });
}

function expectComputedStyleProperties(
  element: HTMLElement,
  expectedProperties: Record<string, string>,
) {
  const style = window.getComputedStyle(element);

  for (const [property, value] of Object.entries(expectedProperties)) {
    expect(style.getPropertyValue(property)).toBe(value);
  }
}

function normalizeCssZeroTokens(value: string) {
  return value
    .split(/\s+/)
    .map((part) => (part === '0' ? '0px' : part))
    .join(' ');
}

function getCssRuleProperties(selector: string, properties: string[]) {
  const style = document.createElement('style');

  style.textContent = globalsCss;
  document.head.append(style);

  try {
    const rule = findCssStyleRule(style.sheet?.cssRules, selector);

    if (!rule) {
      return null;
    }

    return Object.fromEntries(
      properties.map((property) => [property, rule.style.getPropertyValue(property)]),
    );
  } finally {
    style.remove();
  }
}

function getCssMediaRuleProperties(conditionText: string, selector: string, properties: string[]) {
  const style = document.createElement('style');

  style.textContent = globalsCss;
  document.head.append(style);

  try {
    const mediaRule = Array.from(style.sheet?.cssRules ?? [])
      .filter((rule): rule is CSSMediaRule => 'conditionText' in rule)
      .find((rule) => rule.conditionText === conditionText);
    const rule = findCssStyleRule(mediaRule?.cssRules, selector);

    if (!rule) {
      return null;
    }

    return Object.fromEntries(
      properties.map((property) => [property, rule.style.getPropertyValue(property)]),
    );
  } finally {
    style.remove();
  }
}

function getCssMediaConditionsForSelector(selector: string) {
  const style = document.createElement('style');

  style.textContent = globalsCss;
  document.head.append(style);

  try {
    return Array.from(style.sheet?.cssRules ?? [])
      .filter((rule): rule is CSSMediaRule => 'conditionText' in rule)
      .filter((rule) => findCssStyleRule(rule.cssRules, selector))
      .map((rule) => rule.conditionText);
  } finally {
    style.remove();
  }
}

function findCssStyleRule(rules: CSSRuleList | undefined, selector: string): CSSStyleRule | null {
  if (!rules) {
    return null;
  }

  for (const rule of Array.from(rules)) {
    if ('selectorText' in rule && (rule as CSSStyleRule).selectorText === selector) {
      return rule as CSSStyleRule;
    }

    const nestedRules = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    const nestedMatch = findCssStyleRule(nestedRules, selector);

    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

describe('app/components/workspace-shell', () => {
  const legacyAllProjectsLabel = ['All', 'Projects'].join(' ');

  it('pins the shared search slot to a symmetric center column in the header grid', () => {
    expect(globalsCss).toContain('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);');
    expect(globalsCss).toContain('justify-self: start;');
    expect(globalsCss).toContain('justify-self: end;');
  });

  it('uses a single AppShell header height across mobile and desktop', () => {
    const html = renderWorkspaceShell(true);

    expect(html).toContain('--app-shell-header-height:calc(3.5rem * var(--mantine-scale));');
    expect(html).not.toContain('--app-shell-header-height:calc(6.5rem * var(--mantine-scale));');
    expect(html).not.toContain('@media(min-width: 48em){:root{--app-shell-header-height:');
  });

  it('keeps the mobile header CSS below Mantine sm where AppShell switches to 56px', () => {
    const mediaConditions = getCssMediaConditionsForSelector('.workspace-header-inner');

    expect(mediaConditions).toContain('(max-width: 47.999em)');
    expect(mediaConditions).not.toContain('(max-width: 48em)');
  });

  it('keeps collapsed desktop sidebar offset from shifting the mobile brand', () => {
    const mobileHeaderRule = getCssMediaRuleProperties(
      '(max-width: 47.999em)',
      '.workspace-header-inner',
      ['gap'],
    );

    expect(normalizeCssZeroTokens(mobileHeaderRule?.gap ?? '')).toBe('0px 8px');
    expect(
      getCssMediaRuleProperties(
        '(max-width: 47.999em)',
        '.workspace-header-inner--sidebar-collapsed .workspace-header-brand',
        ['margin-left'],
      ),
    ).toEqual({
      'margin-left': '0px',
    });
  });

  it('renders header slots as direct grid children with explicit end placement', () => {
    const { container } = renderWorkspaceShellDom(true);
    const headerInner = container.querySelector<HTMLElement>('.workspace-header-inner');

    expect(headerInner).not.toBeNull();

    const start = headerInner?.querySelector<HTMLElement>(':scope > .workspace-header-start');
    const brand = headerInner?.querySelector<HTMLElement>(':scope > .workspace-header-brand');
    const middle = headerInner?.querySelector<HTMLElement>(':scope > .workspace-header-middle');
    const end = headerInner?.querySelector<HTMLElement>(':scope > .workspace-header-end');

    expect(start).not.toBeNull();
    expect(brand).not.toBeNull();
    expect(middle).not.toBeNull();
    expect(end).not.toBeNull();
    expectBefore(start as HTMLElement, brand as HTMLElement);
    expectBefore(brand as HTMLElement, middle as HTMLElement);
    expectBefore(middle as HTMLElement, end as HTMLElement);

    const fixture = renderWorkspaceCssFixture(`
      <div class="workspace-header-inner">
        <div class="workspace-header-start"></div>
        <a class="workspace-brand-link workspace-header-brand" data-testid="brand"></a>
        <div class="workspace-header-middle" data-testid="middle"></div>
        <div class="workspace-header-end" data-testid="end"></div>
      </div>
    `);

    try {
      expectComputedStyleProperties(getRequiredFixtureElement(fixture.fixture, 'brand'), {
        'grid-column': '1',
        'grid-row': '1',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture.fixture, 'middle'), {
        'grid-column': '2',
        'grid-row': '1',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture.fixture, 'end'), {
        'grid-column': '3',
        'grid-row': '1',
      });
      expect(
        getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-start', [
          'grid-column',
          'grid-row',
        ]),
      ).toEqual({
        'grid-column': '1',
        'grid-row': '1',
      });
      expect(
        getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-brand', [
          'grid-column',
          'grid-row',
        ]),
      ).toEqual({
        'grid-column': '2',
        'grid-row': '1',
      });
      expect(
        getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-middle', [
          'grid-column',
          'grid-row',
        ]),
      ).toEqual({
        'grid-column': '3',
        'grid-row': '1',
      });
      expect(
        getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-end', [
          'grid-column',
          'grid-row',
        ]),
      ).toEqual({
        'grid-column': '4',
        'grid-row': '1',
      });
    } finally {
      fixture.cleanup();
    }
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

  it('matches the desktop account avatar size to the 44px navbar controls', () => {
    expect(
      getCssRuleProperties('.workspace-avatar-trigger,\n.workspace-notification-trigger', [
        'border-style',
        'background',
        'width',
        'min-width',
        'height',
        'padding-top',
      ]),
    ).toEqual({
      'border-style': 'none',
      background: 'transparent',
      width: 'var(--ui-hit-touch-min)',
      'min-width': 'var(--ui-hit-touch-min)',
      height: 'var(--ui-hit-touch-min)',
      'padding-top': '0px',
    });
    expect(workspaceShellSource).toMatch(
      /className="workspace-avatar-trigger"[\s\S]*<Avatar color="blue" radius="xl" size=\{32\}>/,
    );
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

  it('shows the collapse toggle inside the desktop sidebar header while open', () => {
    const html = renderWorkspaceShell({ desktopOpened: true });

    expect(html).toContain('workspace-sidebar-toggle-row');
    expect(html).toContain('workspace-sidebar-toggle');
    expect(html).toContain('Collapse sidebar');
    expect(workspaceShellSource).toContain('IconLayoutSidebarLeftCollapse');
    expect(workspaceShellSource).not.toContain('IconChevronLeft');
    expect(html).not.toContain('workspace-divider-rail');
  });

  it('keeps the expand toggle inside the desktop sidebar header while collapsed', () => {
    const html = renderWorkspaceShell({ desktopOpened: false });

    expect(html).toContain('workspace-sidebar-toggle-row');
    expect(html).toContain('workspace-sidebar-toggle');
    expect(html).toContain('Expand sidebar');
    expect(workspaceShellSource).toContain('IconLayoutSidebarLeftExpand');
    expect(workspaceShellSource).not.toContain('IconChevronRight');
    expect(html).not.toContain('workspace-divider-rail');
    expect(html).not.toContain('workspace-header-sidebar-toggle');
  });

  it('uses a wider desktop sidebar and keeps a compact sidebar when collapsed', () => {
    const openHtml = renderWorkspaceShell({ desktopOpened: true });
    const collapsedHtml = renderWorkspaceShell({ desktopOpened: false });

    expect(openHtml).toContain('--app-shell-navbar-width:calc(17.5rem * var(--mantine-scale));');
    expect(collapsedHtml).toContain(
      '--app-shell-navbar-width:calc(4.5rem * var(--mantine-scale));',
    );
    expect(collapsedHtml).toContain('workspace-shell--sidebar-collapsed');
    expect(collapsedHtml).toContain('workspace-navbar--collapsed');
    expect(collapsedHtml).toContain('Dashboard');
    expect(collapsedHtml).toContain('Recent projects');
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

  it('keeps the mobile project picker in the header middle slot and places the compact search trigger before the avatar', () => {
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

  it('uses recent project links as the desktop board navigation', () => {
    const { container } = renderWorkspaceShellDom({ desktopOpened: true });
    const navbar = within(getWorkspaceNavbar(container));
    const dashboardLink = navbar.getByRole('link', { name: 'Dashboard' });
    const projectsLink = navbar.getByRole('link', { name: 'Projects' });
    const recentLabel = navbar.getByText('Recent projects');
    const alphaBoardLink = navbar.getByRole('link', { name: /ALPHA\s*Alpha/ });

    expect(navbar.queryByRole('link', { name: 'Boards' })).toBeNull();
    expectBefore(dashboardLink, projectsLink);
    expectBefore(projectsLink, recentLabel);
    expectBefore(recentLabel, alphaBoardLink);
  });

  it('keeps primary and settings links ordered without redundant section labels', () => {
    const { container } = renderWorkspaceShellDom({ desktopOpened: true });
    const navbar = within(getWorkspaceNavbar(container));
    const dashboardLink = navbar.getByRole('link', { name: 'Dashboard' });
    const recentLabel = navbar.getByText('Recent projects');
    const settingsLink = navbar.getByRole('link', { name: 'Settings' });
    const connectionsLink = navbar.getByRole('link', { name: 'Connections' });

    expect(navbar.queryByRole('heading', { level: 2, name: 'Workspace' })).toBeNull();
    expect(navbar.queryByRole('heading', { level: 2, name: 'Manage' })).toBeNull();
    expectBefore(dashboardLink, recentLabel);
    expectBefore(recentLabel, settingsLink);
    expectBefore(settingsLink, connectionsLink);
    expect(navbar.queryByText('Workspace')).toBeNull();
    expect(navbar.queryByText('Manage')).toBeNull();
    expect(navbar.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
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

  it('shows five recent project cards directly below the primary workspace links', () => {
    const { container } = renderWorkspaceShellDom({
      desktopOpened: true,
      pathname: '/board/PROJECT-1',
      rememberedProjectKey: 'PROJECT-1|PROJECT-6|PROJECT-5|PROJECT-4|PROJECT-3|PROJECT-2',
      projectOptions: makeActiveProjectOptions(10),
    });
    const navbar = within(getWorkspaceNavbar(container));
    const projectsLink = navbar.getByRole('link', { name: 'Projects' });
    const recentLabel = navbar.getByText('Recent projects');
    const quickBoardLinks = Array.from(
      container.querySelectorAll<HTMLElement>('.workspace-board-subnav-link'),
    );

    expect(navbar.queryByRole('link', { name: 'Boards' })).toBeNull();
    expectBefore(projectsLink, recentLabel);
    expect(quickBoardLinks.map((link) => link.textContent?.trim())).toEqual([
      'PROJECT-6Project 6',
      'PROJECT-5Project 5',
      'PROJECT-4Project 4',
      'PROJECT-3Project 3',
      'PROJECT-2Project 2',
    ]);
    expect(quickBoardLinks[0]?.querySelector('.workspace-board-subnav-key')?.textContent).toBe(
      'PROJECT-6',
    );
    expect(container.querySelector('[href="/board/PROJECT-7"]')).toBeNull();
  });

  it('uses project card backgrounds for recent board cards without colored initials', () => {
    const { container } = renderWorkspaceShellDom({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
      projectOptions: [
        {
          id: '1',
          name: 'Alpha',
          projectKey: 'ALPHA',
          status: 'active',
          bgImage: 'forest',
        },
      ],
    });
    const boardLink = container.querySelector<HTMLElement>('.workspace-board-subnav-link');
    const keyBadge = boardLink?.querySelector<HTMLElement>('.workspace-board-subnav-key');
    const boardCardBgStyle =
      boardLink?.style.getPropertyValue('--workspace-board-card-bg-image') ?? '';

    expect(boardCardBgStyle).toContain('images.unsplash.com');
    expect(boardLink?.getAttribute('aria-label')).toBeNull();
    expect(keyBadge?.textContent).toBe('ALPHA');
    expect(keyBadge?.hasAttribute('aria-hidden')).toBe(false);
    expect(boardLink?.querySelector('.workspace-board-subnav-avatar')).toBeNull();
    expect(keyBadge?.hasAttribute('data-tone')).toBe(false);
  });

  it('marks the current board when it is in the recent projects list', () => {
    const html = renderWorkspaceShell({
      desktopOpened: true,
      pathname: '/board/PROJECT-5',
      rememberedProjectKey: 'PROJECT-5|PROJECT-6|PROJECT-5|PROJECT-4|PROJECT-3|PROJECT-2',
      projectOptions: makeActiveProjectOptions(10),
    });

    expect(html).toContain('href="/board/PROJECT-5"');
    expect(html).toMatch(
      /href="\/board\/PROJECT-5"[\s\S]*workspace-board-subnav-link[\s\S]*aria-current="page"/,
    );
    expect(html.match(/workspace-board-subnav-link/g) ?? []).toHaveLength(5);
    expect(html).toContain('data-current-board-index="1"');
  });

  it('uses the external recent project state instead of localStorage during render', () => {
    window.localStorage.setItem(
      RECENT_PROJECTS_STORAGE,
      JSON.stringify(['PROJECT-8', 'PROJECT-7']),
    );

    try {
      const html = renderWorkspaceShell({
        desktopOpened: true,
        pathname: '/board/PROJECT-1',
        rememberedProjectKey: 'PROJECT-1',
        projectOptions: makeActiveProjectOptions(6),
      });

      expect(html).toContain('href="/board/PROJECT-2"');
      expect(html).toContain('href="/board/PROJECT-5"');
      expect(html).not.toContain('href="/board/PROJECT-7"');
      expect(html).not.toContain('href="/board/PROJECT-8"');
    } finally {
      window.localStorage.removeItem(RECENT_PROJECTS_STORAGE);
    }
  });

  it('keeps recent projects inline and opens all projects in a popup menu', () => {
    ensureBrowserObservers();
    ensureMatchMedia();

    useDisclosureMock.mockReset();
    useDisclosureMock.mockImplementation((opened = false) => [
      opened,
      { toggle: vi.fn(), close: vi.fn() },
    ]);
    usePathnameMock.mockReturnValue('/board/PROJECT-1');
    useSyncExternalStoreMock.mockReset();
    useSyncExternalStoreMock.mockImplementation(
      () => 'PROJECT-1|PROJECT-6|PROJECT-5|PROJECT-4|PROJECT-3|PROJECT-2',
    );

    const { container } = render(workspaceShellElement(makeActiveProjectOptions(8)));
    const boardLabels = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.workspace-board-subnav-link')).map(
        (link) => link.textContent?.trim(),
      );

    expect(boardLabels()).toEqual([
      'PROJECT-6Project 6',
      'PROJECT-5Project 5',
      'PROJECT-4Project 4',
      'PROJECT-3Project 3',
      'PROJECT-2Project 2',
    ]);
    fireEvent.click(
      within(getWorkspaceNavbar(container)).getByRole('button', { name: 'View all projects' }),
    );

    expect(boardLabels()).toEqual([
      'PROJECT-6Project 6',
      'PROJECT-5Project 5',
      'PROJECT-4Project 4',
      'PROJECT-3Project 3',
      'PROJECT-2Project 2',
    ]);
    expect(workspaceShellSource).toMatch(
      /<Menu[\s\S]*position="right-start"[\s\S]*className="workspace-board-subnav-more"[\s\S]*<ProjectPickerMenuItems\s+projectOptions=\{orderedProjectOptions\}/,
    );
  });

  it('shows the number of boards hidden from the recent list in the View all projects badge', () => {
    const { container } = renderWorkspaceShellDom({
      desktopOpened: true,
      projectOptions: makeActiveProjectOptions(10),
    });
    const overflowCount = container.querySelector('.workspace-board-subnav-more-count');

    expect(overflowCount?.textContent).toBe('5');
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
    expect(html).toContain('Recent projects');
    expect(html).not.toContain('aria-label="Boards"');
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
    expect(html).toContain('transform:translateY(72px)');
    expect(html).not.toContain('workspace-board-subnav-pulse');
  });

  it('recomputes board ordering when later recent project keys change', () => {
    ensureBrowserObservers();
    ensureMatchMedia();

    const projectOptions = [
      { id: '1', name: 'Alpha', projectKey: 'ALPHA', status: 'active' },
      { id: '2', name: 'Beta', projectKey: 'BETA', status: 'active' },
      { id: '3', name: 'Gamma', projectKey: 'GAMMA', status: 'active' },
      { id: '4', name: 'Delta', projectKey: 'DELTA', status: 'active' },
    ] satisfies WorkspaceProjectOption[];
    let projectOrderState = 'ALPHA|BETA|GAMMA';

    useDisclosureMock.mockReset();
    useDisclosureMock.mockImplementation((opened = false) => [
      opened,
      { toggle: vi.fn(), close: vi.fn() },
    ]);
    usePathnameMock.mockReturnValue('/board/ALPHA');
    useSyncExternalStoreMock.mockReset();
    useSyncExternalStoreMock.mockImplementation(() => projectOrderState);
    window.localStorage.setItem(RECENT_PROJECTS_STORAGE, JSON.stringify(['BETA', 'GAMMA']));

    try {
      const { container, rerender } = render(workspaceShellElement(projectOptions));
      const boardLabels = () =>
        Array.from(container.querySelectorAll<HTMLElement>('.workspace-board-subnav-link')).map(
          (link) => link.textContent?.trim(),
        );

      expect(boardLabels()).toEqual(['BETABeta', 'GAMMAGamma', 'ALPHAAlpha', 'DELTADelta']);

      window.localStorage.setItem(RECENT_PROJECTS_STORAGE, JSON.stringify(['BETA', 'DELTA']));
      projectOrderState = 'ALPHA|BETA|DELTA';
      rerender(workspaceShellElement(projectOptions));

      expect(boardLabels()).toEqual(['BETABeta', 'DELTADelta', 'ALPHAAlpha', 'GAMMAGamma']);
    } finally {
      window.localStorage.removeItem(RECENT_PROJECTS_STORAGE);
    }
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
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <a class="workspace-board-subnav-link" data-testid="board-link"></a>
    `);

    try {
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'board-link'), {
        'min-height': '64px',
        'padding-top': '8px',
        'padding-right': '10px',
        'padding-bottom': '8px',
        'padding-left': '10px',
      });
    } finally {
      cleanup();
    }
  });

  it('keeps Mantine root hover and current backgrounds on project-card surfaces', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <a class="workspace-board-subnav-link" data-active="true" data-testid="active"></a>
      <a class="workspace-board-subnav-link" aria-current="page" data-testid="current"></a>
    `);

    try {
      for (const testId of ['active', 'current']) {
        expectComputedStyleProperties(getRequiredFixtureElement(fixture, testId), {
          '--workspace-board-card-surface': 'var(--ui-workspace-board-card-hover-surface)',
          '--workspace-board-card-overlay':
            'linear-gradient(135deg,var(--ui-workspace-board-card-hover-overlay-start),var(--ui-workspace-board-card-hover-overlay-end))',
        });
      }
    } finally {
      cleanup();
    }
  });

  it('defines an in-bounds focus treatment for nested board links', () => {
    const nestedBoardFocusRule = getCssRuleProperties(
      '.workspace-board-subnav-link:focus-visible',
      ['outline', '--workspace-board-card-surface', 'color', 'box-shadow'],
    );
    const nestedBoardBodyFocusRule = getCssRuleProperties(
      '.workspace-board-subnav-link:focus-visible .mantine-NavLink-body',
      ['background'],
    );

    expect(nestedBoardFocusRule).toEqual({
      outline: 'none',
      '--workspace-board-card-surface': 'var(--ui-workspace-accent-surface)',
      color: 'var(--ui-text)',
      'box-shadow': 'var(--ui-workspace-focus-shadow)',
    });
    expect(nestedBoardBodyFocusRule).toBeNull();
  });

  it('defines a custom focus-visible treatment for top-level workspace nav links', () => {
    const { container } = renderWorkspaceShellDom({
      desktopOpened: true,
      pathname: '/board/ALPHA',
      rememberedProjectKey: 'ALPHA',
    });
    const navbar = within(getWorkspaceNavbar(container));
    const currentBoardLink = navbar.getByRole('link', { name: /ALPHA\s*Alpha/ });
    const focusRule = getCssRuleProperties(
      '.workspace-nav-link:not(.workspace-board-subnav-link):focus-visible',
      ['outline', 'background', 'color', 'box-shadow'],
    );

    expect(navbar.queryByRole('link', { name: 'Boards' })).toBeNull();
    expect(Array.from(currentBoardLink.classList)).toContain('workspace-board-subnav-link');
    expect(focusRule).toEqual({
      outline: 'none',
      background: 'var(--ui-workspace-accent-surface)',
      color: 'var(--ui-text)',
      'box-shadow': 'var(--ui-workspace-focus-shadow)',
    });
    expect(getCssRuleProperties('.workspace-nav-link:focus-visible', ['background'])).toBeNull();
  });

  it('keeps top-level nav link hooks without sidebar section labels', () => {
    const { container } = renderWorkspaceShellDom({ desktopOpened: true });
    const navbar = within(getWorkspaceNavbar(container));

    expect(navbar.queryByRole('heading', { level: 2, name: 'Workspace' })).toBeNull();
    expect(navbar.queryByRole('heading', { level: 2, name: 'Manage' })).toBeNull();
    expect(navbar.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(workspaceShellSource).not.toContain('workspace-nav-section-label');
    expect(globalsCss).not.toContain('.workspace-nav-section-label');

    ['Dashboard', 'Projects', 'Settings', 'Connections'].forEach((name) => {
      const link = navbar.getByRole('link', { name });

      expect(Array.from(link.classList)).toContain('workspace-nav-link');
      expect(Array.from(link.classList)).not.toContain('workspace-board-subnav-link');
    });
    expect(navbar.queryByRole('link', { name: 'Boards' })).toBeNull();
  });

  it('defines a shared focus-visible treatment for header and sidebar controls', () => {
    expect(globalsCss).toMatch(
      /\.workspace-brand-link:focus-visible,\s*\.workspace-sidebar-toggle:focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*border-color:\s*var\(--ui-accent\);[\s\S]*box-shadow:\s*var\(--ui-workspace-outer-focus-shadow\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-notification-trigger:focus-visible,\s*\.workspace-avatar-trigger:focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*background:\s*var\(--ui-workspace-control-hover-surface\);[\s\S]*box-shadow:\s*var\(--ui-workspace-outer-focus-shadow\);/,
    );
  });

  it('reduces the nested board list inset and removes the selected pulse decoration', () => {
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav\s*\{[^}]*margin-left:\s*8px;[^}]*padding:\s*0;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-surface\s*\{[^}]*top:\s*0;[^}]*left:\s*0;[^}]*right:\s*0;/,
    );
    expect(globalsCss).not.toContain('.workspace-board-subnav-pulse');
  });

  it('uses flatter token-based sidebar chrome instead of blur-heavy gradients', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <a class="workspace-board-subnav-link" data-current-board="true" data-testid="current-board"></a>
    `);

    expect(globalsCss).not.toMatch(/\.workspace-navbar\s*\{[^}]*backdrop-filter:/);
    try {
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'current-board'), {
        '--workspace-board-card-surface': 'var(--ui-workspace-board-card-current-surface)',
      });
    } finally {
      cleanup();
    }
    expect(globalsCss).toMatch(
      /\.workspace-nav-link\[data-active=["']true["']\]\s*\{[^}]*background:\s*var\(--ui-workspace-accent-surface\);[^}]*color:\s*var\(--ui-text\);/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-nav-link\[data-active=["']true["']\]\s*\{[^}]*background:\s*var\(--ui-workspace-accent-surface\);[^}]*color:\s*var\(--ui-text\);/,
    );
  });

  it('keeps the header and account menu on flat surfaces instead of blur-heavy chrome', () => {
    expect(globalsCss).not.toMatch(/\.workspace-header\s*\{[^}]*backdrop-filter:/);
    expect(globalsCss).not.toMatch(/\.workspace-user-menu\s*\{[^}]*backdrop-filter:/);
    expect(globalsCss).toMatch(/\.workspace-header\s*\{[^}]*background:\s*var\(--ui-surface\);/);
    expect(globalsCss).toMatch(
      /\.workspace-user-menu \.workspace-signout-btn\s*\{[^}]*background:\s*transparent;/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-user-menu\s*\{[^}]*background:\s*var\(--ui-workspace-popover-surface\);/,
    );
  });

  it('keeps repeated workspace chrome surfaces and shadows on ui tokens', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <header class="workspace-header" data-testid="header"></header>
      <nav class="workspace-navbar" data-testid="navbar"></nav>
      <button class="command-palette-trigger" data-testid="command-palette-trigger"></button>
      <a class="workspace-mobile-project-picker" data-testid="mobile-project-picker"></a>
      <div class="workspace-user-menu" data-testid="user-menu"></div>
    `);

    try {
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'header'), {
        background: 'var(--ui-surface)',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'navbar'), {
        background: 'var(--ui-surface)',
        'box-shadow': 'var(--ui-elevation-1)',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'command-palette-trigger'), {
        background: 'var(--ui-workspace-control-surface)',
        'box-shadow': 'var(--ui-workspace-control-inset), var(--ui-workspace-control-shadow)',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'mobile-project-picker'), {
        background: 'var(--ui-workspace-control-surface)',
        'box-shadow': 'var(--ui-workspace-control-inset), var(--ui-workspace-control-shadow)',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'user-menu'), {
        background: 'var(--ui-workspace-popover-surface)',
        'box-shadow': 'var(--ui-workspace-popover-shadow)',
      });
    } finally {
      cleanup();
    }
  });

  it('shares accent state tokens between project picker items and board subnav', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <button class="workspace-project-picker-item is-selected" data-testid="project-picker"></button>
      <button class="workspace-board-picker-item" data-current-board="true" data-testid="board-picker"></button>
      <a class="workspace-board-subnav-link" data-current-board="true" data-testid="current-board-link"></a>
    `);

    expect(globalsCss).toMatch(/--ui-workspace-accent-surface:/);
    expect(globalsCss).toMatch(/--ui-workspace-accent-border:/);
    expect(globalsCss).toMatch(/--ui-workspace-focus-shadow:/);
    try {
      for (const testId of ['project-picker', 'board-picker']) {
        expectComputedStyleProperties(getRequiredFixtureElement(fixture, testId), {
          background: 'var(--ui-workspace-accent-surface)',
          'box-shadow': 'inset 0 0 0 1px var(--ui-workspace-accent-border)',
        });
      }
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'current-board-link'), {
        '--workspace-board-card-surface': 'var(--ui-workspace-board-card-current-surface)',
        '--workspace-board-card-overlay':
          'linear-gradient(135deg,var(--ui-workspace-board-card-current-overlay-start),var(--ui-workspace-board-card-current-overlay-end))',
      });
    } finally {
      cleanup();
    }
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-link:focus-visible\s*\{[\s\S]*--workspace-board-card-surface:\s*var\(--ui-workspace-accent-surface\);[\s\S]*box-shadow:\s*var\(--ui-workspace-focus-shadow\);/,
    );
  });

  it('keeps the board overflow row on workspace tokens', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <button class="workspace-board-subnav-more" data-testid="more"></button>
    `);

    try {
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'more'), {
        'min-height': '36px',
        background: 'transparent',
        color: 'var(--ui-accent)',
      });
    } finally {
      cleanup();
    }
  });

  it('styles recent project rows as project cards with key badges', () => {
    expect(workspaceShellSource).toContain('workspace-board-subnav-key');
    expect(workspaceShellSource).not.toContain('workspace-board-subnav-avatar');
    expect(workspaceShellSource).toContain('View all projects');
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-link\s*\{[^}]*min-height:\s*64px;[^}]*padding:\s*8px 10px;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-key\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*96px;[^}]*border-radius:\s*7px;/,
    );
    expect(globalsCss).not.toContain('.workspace-board-subnav-avatar');
    expect(globalsCss).not.toContain('[data-tone');
    expect(globalsCss).toMatch(
      /\.workspace-board-subnav-link\[data-current-board=["']true["']\]\s*\{[^}]*box-shadow:\s*[\s\S]*inset 0 0 0 1px var\(--ui-accent\),/,
    );
  });

  it('keeps the project key badge border inside compact recent project rows', () => {
    const { fixture, cleanup } = renderWorkspaceCssFixture(`
      <div class="workspace-shell--sidebar-collapsed">
        <span class="workspace-board-subnav-key" data-testid="project-key">PQST</span>
      </div>
    `);

    try {
      expect(
        getCssRuleProperties('.workspace-board-subnav-key', ['border', 'border-radius']),
      ).toEqual({
        border: '1px solid var(--ui-workspace-board-card-key-border)',
        'border-radius': '7px',
      });
      expectComputedStyleProperties(getRequiredFixtureElement(fixture, 'project-key'), {
        'box-sizing': 'border-box',
        width: '36px',
        'max-width': '36px',
      });
    } finally {
      cleanup();
    }
  });

  it('collapses the desktop sidebar to icons and compact project key rows', () => {
    expect(workspaceShellSource).toMatch(
      /navbar=\{\{\s*width:\s*desktopOpened\s*\?\s*WORKSPACE_NAVBAR_WIDTH\s*:\s*WORKSPACE_NAVBAR_COLLAPSED_WIDTH,[\s\S]*desktop:\s*false\s*\}/,
    );
    expect(workspaceShellSource).toMatch(/aria-label="Dashboard"[\s\S]*label="Dashboard"/);
    expect(globalsCss).toMatch(
      /\.workspace-shell--sidebar-collapsed[\s\S]*\.workspace-nav-link:not\(\.workspace-board-subnav-link\)[\s\S]*\.mantine-NavLink-body\s*\{[^}]*display:\s*none;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-shell--sidebar-collapsed \.workspace-board-subnav-name,\s*\.workspace-shell--sidebar-collapsed \.workspace-board-subnav-heading,\s*\.workspace-shell--sidebar-collapsed \.workspace-board-subnav-more\s*\{[^}]*display:\s*none;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-shell--sidebar-collapsed \.workspace-board-subnav-link\s*\{[^}]*width:\s*48px;[^}]*min-height:\s*48px;[^}]*padding:\s*6px;/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-shell--sidebar-collapsed \.workspace-board-subnav-key\s*\{[^}]*max-width:\s*36px;/,
    );
  });

  it('keeps the left header chrome on token-driven dark surfaces', () => {
    expect(globalsCss).not.toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-brand-link,\s*html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-avatar-trigger\s*\{/,
    );
    expect(globalsCss).not.toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-notification-trigger\s*\{/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-mobile-project-picker\s*\{[^}]*border-color:\s*var\(--ui-workspace-control-border\);[^}]*background:\s*var\(--ui-workspace-control-surface\);/,
    );
    expect(globalsCss).toMatch(
      /html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-mobile-project-picker:hover,\s*html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-mobile-project-picker:focus-visible\s*\{[^}]*border-color:\s*var\(--ui-workspace-accent-border-soft\);[^}]*background:\s*var\(--ui-workspace-control-hover-surface\);/,
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
      /@media\s*\(max-width:\s*47\.999em\)\s*\{[\s\S]*\.workspace-header-inner\s*\{[\s\S]*padding-inline:\s*0;/,
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
      /@media\s*\(max-width:\s*47\.999em\)\s*\{[\s\S]*\.workspace-header,\s*[\s\S]*\.workspace-navbar\s*\{[\s\S]*background:\s*var\(--ui-surface-strong\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*47\.999em\)\s*\{[\s\S]*\.workspace-navbar\s*\{[\s\S]*box-shadow:\s*var\(--ui-elevation-3\);/,
    );
    expect(globalsCss).toMatch(
      /@media\s*\(max-width:\s*48em\)\s*\{[\s\S]*html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-header,\s*[\s\S]*html\[data-mantine-color-scheme=["']dark["']\]\s+\.workspace-navbar\s*\{[\s\S]*background:\s*var\(--ui-surface-strong\);/,
    );
    expect(globalsCss).toMatch(
      /\.workspace-mobile-account\s*\{[^}]*background:\s*var\(--ui-workspace-popover-surface\);[^}]*padding:\s*10px;/,
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

  it('keeps the compact project picker in the mobile header row and scopes compact trigger styles', () => {
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-brand-copy', ['display']),
    ).toEqual({ display: 'none' });
    expect(
      getCssRuleProperties('.command-palette-trigger--compact', [
        'display',
        'align-items',
        'width',
        'min-width',
        'justify-content',
      ]),
    ).toEqual({
      display: 'flex',
      'align-items': 'center',
      width: 'var(--ui-hit-touch-min)',
      'min-width': 'var(--ui-hit-touch-min)',
      'justify-content': 'center',
    });
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-middle', [
        'justify-content',
      ]),
    ).toEqual({ 'justify-content': 'stretch' });
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-mobile-project-picker', [
        'margin',
      ]),
    ).toEqual({ margin: '0px' });
    expect(getCssRuleProperties('.workspace-mobile-project-picker', ['min-height'])).toEqual({
      'min-height': 'var(--ui-hit-touch-min)',
    });
  });

  it('lets the mobile picker shrink between fixed header controls', () => {
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-inner', [
        'grid-template-columns',
        'grid-template-rows',
      ]),
    ).toEqual({
      'grid-template-columns': 'auto auto minmax(0, 1fr) auto',
      'grid-template-rows': '56px',
    });
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-header-middle', [
        'width',
        'min-width',
      ]),
    ).toEqual({
      width: '100%',
      'min-width': '0px',
    });
  });

  it('gives the mobile project picker responsive room for long project names', () => {
    expect(getCssRuleProperties('.workspace-mobile-project-picker', ['max-width'])).toEqual({
      'max-width': 'min(60vw, 260px)',
    });
    expect(getCssRuleProperties('.workspace-mobile-project-picker-label', ['max-width'])).toEqual({
      'max-width': 'min(38vw, 168px)',
    });
    expect(
      getCssMediaRuleProperties('(max-width: 47.999em)', '.workspace-mobile-project-picker', [
        'width',
        'min-width',
        'max-width',
      ]),
    ).toEqual({
      width: '100%',
      'min-width': '0px',
      'max-width': '100%',
    });
  });
});
