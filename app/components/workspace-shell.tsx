'use client';

import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconFolders,
  IconHome2,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlugConnected,
  IconSettings,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { outfit } from '@/app/fonts';
import { getProjectCardBgUrl } from '@/lib/project-backgrounds';
import { ACTIVE_PROJECT_STATUS } from '@/lib/project-meta';
import {
  findProjectByKey,
  findVisibleProjectByKey,
  getProjectSelectHref,
  getRecencyOrderedProjectOptions,
  getWorkspaceProjectSubtitle,
  LAST_PROJECT_KEY_STORAGE,
  pushRecentProjectKey,
  readRecentProjectKeys,
  RECENT_PROJECTS_CHANGED_EVENT,
  RECENT_PROJECTS_STORAGE,
  resolvePickerProject,
  type WorkspaceProjectOption,
} from '@/lib/workspace-project-picker';

import type { CommandPaletteProps } from './command-palette';
import { COMMAND_PALETTE_OPEN_EVENT, CommandPaletteTrigger } from './command-palette-trigger';
import { ProjectPickerMenuItems } from './project-picker-menu';
import { TaskNotificationCenter } from './task-notification-center';

const CommandPalette = dynamic<CommandPaletteProps>(
  () => import('./command-palette').then((mod) => mod.CommandPalette),
  { ssr: false },
);

export type WorkspaceNavKey = 'dashboard' | 'projects' | 'kanban' | 'settings' | 'connections';

type WorkspaceShellProps = {
  email: string;
  projectOptions: WorkspaceProjectOption[];
  dashboardHref: string;
  projectsHref: string;
  kanbanHref: string;
  settingsHref: string;
  apiKeysHref: string;
  signOutControl: React.ReactNode;
  children: React.ReactNode;
};

export function resolveWorkspaceKanbanHref(
  kanbanHref: string,
  rememberedProjectKey: string | null,
  projectOptions: WorkspaceProjectOption[],
) {
  if (!rememberedProjectKey) return kanbanHref;
  const project = findVisibleProjectByKey(projectOptions, rememberedProjectKey);
  return project ? `/board/${project.projectKey}` : kanbanHref;
}

function initialFromEmail(email: string) {
  const trimmed = email.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'U';
}

const PROJECT_KEY_CHANGED_EVENT = 'pm:lastProjectKey:changed';
const WORKSPACE_NAVBAR_WIDTH = 320;
const WORKSPACE_NAVBAR_COLLAPSED_WIDTH = 72;
const BOARD_SUBNAV_ROW_HEIGHT = 64;
const BOARD_SUBNAV_COLLAPSED_ROW_HEIGHT = 48;
const BOARD_SUBNAV_ROW_GAP = 8;
const BOARD_RECENT_LINK_LIMIT = 5;

type BoardNavLinkProps = {
  project: WorkspaceProjectOption;
  isCurrentBoard: boolean;
  onSelect: () => void;
};

function BoardNavLink({ project, isCurrentBoard, onSelect }: BoardNavLinkProps) {
  const backgroundUrl = getProjectCardBgUrl(project.bgImage);
  const backgroundStyle = backgroundUrl
    ? ({
        '--workspace-board-card-bg-image': `url("${backgroundUrl}")`,
      } as React.CSSProperties)
    : undefined;

  return (
    <NavLink
      component={Link}
      href={`/board/${project.projectKey}`}
      prefetch={false}
      label={
        <span className="workspace-board-subnav-label">
          <span className="workspace-board-subnav-key">{project.projectKey}</span>
          <span className="workspace-board-subnav-name">{project.name}</span>
        </span>
      }
      onClick={onSelect}
      className="workspace-nav-link workspace-board-subnav-link"
      data-current-board={isCurrentBoard ? 'true' : undefined}
      aria-current={isCurrentBoard ? 'page' : undefined}
      title={`${project.projectKey} - ${project.name}`}
      style={backgroundStyle}
    />
  );
}

function partitionWorkspaceProjectOptions(projectOptions: WorkspaceProjectOption[]) {
  return projectOptions.filter((project) => project.status === ACTIVE_PROJECT_STATUS);
}

function readRememberedProjectKey() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(LAST_PROJECT_KEY_STORAGE);
    const normalized = (value || '').trim();
    return normalized || null;
  } catch {
    return null;
  }
}

function writeRememberedProjectKey(projectKey: string | null) {
  if (typeof window === 'undefined') return;

  try {
    if (projectKey) {
      window.localStorage.setItem(LAST_PROJECT_KEY_STORAGE, projectKey);
      pushRecentProjectKey(projectKey);
    } else {
      window.localStorage.removeItem(LAST_PROJECT_KEY_STORAGE);
    }
  } catch {
    // ignore storage failures
  }

  window.dispatchEvent(new Event(PROJECT_KEY_CHANGED_EVENT));
}

function readProjectOrderState() {
  if (typeof window === 'undefined') return '';
  const rememberedProjectKey = readRememberedProjectKey();
  const recentProjectKeys = readRecentProjectKeys();
  return `${rememberedProjectKey || ''}|${recentProjectKeys.join('|')}`;
}

function subscribeProjectOrderState(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LAST_PROJECT_KEY_STORAGE && event.key !== RECENT_PROJECTS_STORAGE) return;
    onStoreChange();
  };

  const onCustomEvent = () => {
    onStoreChange();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(PROJECT_KEY_CHANGED_EVENT, onCustomEvent);
  window.addEventListener(RECENT_PROJECTS_CHANGED_EVENT, onCustomEvent);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(PROJECT_KEY_CHANGED_EVENT, onCustomEvent);
    window.removeEventListener(RECENT_PROJECTS_CHANGED_EVENT, onCustomEvent);
  };
}

export function WorkspaceShell({
  email,
  projectOptions,
  dashboardHref,
  projectsHref,
  kanbanHref,
  settingsHref,
  apiKeysHref,
  signOutControl,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [commandPaletteRequested, setCommandPaletteRequested] = useState(false);
  const projectOrderState = useSyncExternalStore(
    subscribeProjectOrderState,
    readProjectOrderState,
    () => '',
  );
  const [storedRememberedProjectKey, ...recentProjectKeys] = (projectOrderState || '').split('|');
  const rememberedProjectKey = storedRememberedProjectKey || null;
  const projectOrderMarker = recentProjectKeys.join('|');
  const orderedProjectOptions = useMemo(() => {
    const storedRecentProjectKeys = projectOrderMarker ? projectOrderMarker.split('|') : [];
    return getRecencyOrderedProjectOptions(projectOptions, storedRecentProjectKeys);
  }, [projectOptions, projectOrderMarker]);
  const activeProjectOptions = useMemo(
    () => partitionWorkspaceProjectOptions(orderedProjectOptions),
    [orderedProjectOptions],
  );

  const pickerState = useMemo(
    () =>
      resolvePickerProject({
        pathname,
        rememberedProjectKey,
        projectOptions: orderedProjectOptions,
      }),
    [pathname, rememberedProjectKey, orderedProjectOptions],
  );
  const selectedProject = pickerState.project;
  const effectiveKanbanHref = useMemo(
    () => resolveWorkspaceKanbanHref(kanbanHref, rememberedProjectKey, orderedProjectOptions),
    [kanbanHref, rememberedProjectKey, orderedProjectOptions],
  );

  const active: WorkspaceNavKey = pathname.startsWith('/settings')
    ? 'settings'
    : pathname.startsWith('/connections') || pathname.startsWith('/api-keys')
      ? 'connections'
      : pathname.startsWith('/projects') || pathname.startsWith('/project/')
        ? 'projects'
        : pathname.startsWith('/board')
          ? 'kanban'
          : 'dashboard';
  const currentBoardProject = active === 'kanban' ? selectedProject : null;
  const mobilePickerProject = selectedProject;
  const currentActiveBoardProject =
    currentBoardProject?.status === ACTIVE_PROJECT_STATUS ? currentBoardProject : null;
  const visibleBoardOptions = useMemo(
    () => activeProjectOptions.slice(0, BOARD_RECENT_LINK_LIMIT),
    [activeProjectOptions],
  );
  const currentBoardIndex = currentActiveBoardProject
    ? visibleBoardOptions.findIndex((project) => project.id === currentActiveBoardProject.id)
    : -1;
  const hiddenBoardCount = activeProjectOptions.length - visibleBoardOptions.length;
  const hasBoardOverflow = hiddenBoardCount > 0;
  const isBoardContext = active === 'kanban';
  const currentScopeLabel = mobilePickerProject?.name || 'Boards';
  const workspaceSubtitle = getWorkspaceProjectSubtitle(currentBoardProject);
  const projectFilterAriaLabel = `${isBoardContext ? 'Board picker' : 'Project picker'}. Current: ${currentScopeLabel}`;
  const boardSubnavRowHeight = desktopOpened
    ? BOARD_SUBNAV_ROW_HEIGHT
    : BOARD_SUBNAV_COLLAPSED_ROW_HEIGHT;
  const boardSelectionSurfaceStyle = {
    height: `${boardSubnavRowHeight}px`,
    transform: `translateY(${Math.max(currentBoardIndex, 0) * (boardSubnavRowHeight + BOARD_SUBNAV_ROW_GAP)}px)`,
    opacity: currentBoardIndex === -1 ? 0 : 1,
  };
  const headerInnerClassName = desktopOpened
    ? 'workspace-header-inner'
    : 'workspace-header-inner workspace-header-inner--sidebar-collapsed';
  const shellClassName = desktopOpened
    ? 'workspace-shell'
    : 'workspace-shell workspace-shell--sidebar-collapsed';
  const navbarClassName = desktopOpened
    ? 'workspace-navbar'
    : 'workspace-navbar workspace-navbar--collapsed';
  const handleBoardSelect = useCallback(() => {
    closeMobile();
  }, [closeMobile]);
  const requestCommandPalette = useCallback(() => {
    setCommandPaletteRequested(true);
  }, []);

  function handleProjectSelect(projectKey: string | null) {
    closeMobile();
    if (!projectKey) {
      writeRememberedProjectKey(null);
      router.push(getProjectSelectHref(pathname, null));
      return;
    }

    const project = findProjectByKey(orderedProjectOptions, projectKey);
    if (!project) return;

    writeRememberedProjectKey(project.projectKey);
    router.push(getProjectSelectHref(pathname, project.projectKey));
  }

  useEffect(() => {
    if (pickerState.source !== 'path' || !selectedProject) return;
    if (
      rememberedProjectKey &&
      rememberedProjectKey.toUpperCase() === selectedProject.projectKey.toUpperCase()
    ) {
      return;
    }
    writeRememberedProjectKey(selectedProject.projectKey);
  }, [pickerState.source, rememberedProjectKey, selectedProject]);

  useEffect(() => {
    if (!rememberedProjectKey) return;
    if (findProjectByKey(orderedProjectOptions, rememberedProjectKey)) return;
    writeRememberedProjectKey(null);
  }, [rememberedProjectKey, orderedProjectOptions]);

  // Redirect /board → /board/{projectKey} when a remembered project exists
  useEffect(() => {
    if (pathname !== '/board') return;
    const project = findVisibleProjectByKey(orderedProjectOptions, rememberedProjectKey);
    if (!project) return;
    router.replace(`/board/${project.projectKey}`);
  }, [pathname, rememberedProjectKey, orderedProjectOptions, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      requestCommandPalette();
      window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [requestCommandPalette]);

  const mobileProjectPicker = (
    <Menu
      position="bottom"
      shadow="md"
      width={300}
      withArrow
      arrowPosition="center"
      classNames={{ dropdown: 'workspace-project-picker-menu' }}
    >
      <Menu.Target>
        <UnstyledButton
          className="workspace-mobile-project-picker"
          aria-label={projectFilterAriaLabel}
        >
          <Group gap={8} wrap="nowrap" className="workspace-mobile-project-picker-row">
            <Text size="xs" fw={600} className="workspace-mobile-project-picker-label">
              {currentScopeLabel}
            </Text>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <ProjectPickerMenuItems
          projectOptions={orderedProjectOptions}
          selectedProjectId={mobilePickerProject?.id ?? null}
          onSelect={handleProjectSelect}
        />
      </Menu.Dropdown>
    </Menu>
  );
  const desktopBoardShowMoreButton = hasBoardOverflow ? (
    <Menu
      position="right-start"
      shadow="md"
      width={300}
      withArrow
      classNames={{ dropdown: 'workspace-project-picker-menu' }}
    >
      <Menu.Target>
        <UnstyledButton className="workspace-board-subnav-more" aria-label="View all projects">
          <span className="workspace-board-subnav-more-copy">View all projects</span>
          <span className="workspace-board-subnav-more-count" aria-hidden="true">
            {hiddenBoardCount}
          </span>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <ProjectPickerMenuItems
          projectOptions={orderedProjectOptions}
          selectedProjectId={mobilePickerProject?.id ?? null}
          onSelect={handleProjectSelect}
        />
      </Menu.Dropdown>
    </Menu>
  ) : null;
  const mobileAccountBlock = (
    <Box hiddenFrom="sm" className="workspace-mobile-account-shell">
      <Box className="workspace-mobile-account">
        <Group gap="sm" wrap="nowrap" className="workspace-mobile-account-row">
          <Avatar color="blue" radius="xl" size={32}>
            {initialFromEmail(email)}
          </Avatar>
          <Stack gap={2} className="workspace-mobile-account-copy">
            <Text size="xs" fw={700}>
              Account
            </Text>
            <Text size="xs" c="dimmed" className="workspace-mobile-account-email">
              {email}
            </Text>
          </Stack>
        </Group>
        {signOutControl}
      </Box>
    </Box>
  );

  return (
    <AppShell
      padding={0}
      navbar={{
        width: desktopOpened ? WORKSPACE_NAVBAR_WIDTH : WORKSPACE_NAVBAR_COLLAPSED_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: false },
      }}
      header={{ height: 56 }}
      className={shellClassName}
    >
      <AppShell.Header className="workspace-header">
        <Group justify="space-between" h="100%" wrap="nowrap" className={headerInnerClassName}>
          <Group gap="sm" wrap="nowrap" className="workspace-header-start">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label={mobileOpened ? 'Close navigation' : 'Open navigation'}
            />
          </Group>

          <Link
            href={dashboardHref}
            prefetch={false}
            className="workspace-brand-link workspace-header-brand"
            aria-label="Go to dashboard"
            onClick={closeMobile}
          >
            <Group gap="sm" wrap="nowrap">
              <Image
                src="/brand/preqstation-app-icon.svg"
                alt=""
                width={32}
                height={28}
                className="workspace-brand-mark"
                priority
              />
              <Stack gap={1} className="workspace-brand-copy">
                <Text
                  className={`brand-wordmark workspace-brand-title ${outfit.className}`}
                  fw={800}
                >
                  PREQSTATION
                </Text>
                <Text size="xs" c="dimmed" className="workspace-brand-subtitle" visibleFrom="sm">
                  {workspaceSubtitle}
                </Text>
              </Stack>
            </Group>
          </Link>

          <Box className="workspace-header-middle">
            <Box visibleFrom="md">
              <CommandPaletteTrigger onOpen={requestCommandPalette} />
            </Box>
            <Box hiddenFrom="md">{mobileProjectPicker}</Box>
          </Box>

          <Group gap="xs" wrap="nowrap" className="workspace-header-end">
            <Box hiddenFrom="md">
              <CommandPaletteTrigger onOpen={requestCommandPalette} variant="compact" />
            </Box>
            <TaskNotificationCenter />
            <Box visibleFrom="sm">
              <Menu position="bottom-end" shadow="md" width={220} withArrow>
                <Menu.Target>
                  <UnstyledButton
                    className="workspace-avatar-trigger"
                    aria-label="Open account menu"
                  >
                    <Avatar color="blue" radius="xl" size={32}>
                      {initialFromEmail(email)}
                    </Avatar>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown className="workspace-user-menu">
                  <div className="workspace-user-email">email: {email}</div>
                  <Menu.Divider />
                  {signOutControl}
                </Menu.Dropdown>
              </Menu>
            </Box>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={navbarClassName}>
        <ActionIcon
          size={44}
          radius="md"
          variant="default"
          className="workspace-sidebar-toggle"
          aria-label={desktopOpened ? 'Collapse sidebar' : 'Expand sidebar'}
          onClick={toggleDesktop}
        >
          {desktopOpened ? (
            <IconLayoutSidebarLeftCollapse size={18} />
          ) : (
            <IconLayoutSidebarLeftExpand size={18} />
          )}
        </ActionIcon>
        <AppShell.Section grow component={ScrollArea} px="xs">
          <Stack gap={6} py="xs">
            <NavLink
              component={Link}
              href={dashboardHref}
              prefetch={false}
              active={active === 'dashboard'}
              aria-label="Dashboard"
              aria-current={active === 'dashboard' ? 'page' : undefined}
              onClick={closeMobile}
              label="Dashboard"
              leftSection={<IconHome2 size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            <NavLink
              component={Link}
              href={projectsHref}
              prefetch={false}
              active={active === 'projects'}
              aria-label="Projects"
              aria-current={active === 'projects' ? 'page' : undefined}
              onClick={closeMobile}
              label="Projects"
              leftSection={<IconFolders size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            <Box visibleFrom="md">
              <Stack gap={6}>
                {activeProjectOptions.length > 0 ? (
                  <>
                    <Text component="h3" className="workspace-board-subnav-heading">
                      Recent projects
                    </Text>
                    <Stack
                      gap={BOARD_SUBNAV_ROW_GAP}
                      className="workspace-board-subnav"
                      data-current-board-index={currentBoardIndex}
                    >
                      <span
                        className="workspace-board-subnav-surface"
                        aria-hidden="true"
                        style={boardSelectionSurfaceStyle}
                      />
                      {visibleBoardOptions.map((project) => (
                        <BoardNavLink
                          key={project.id}
                          project={project}
                          isCurrentBoard={currentActiveBoardProject?.id === project.id}
                          onSelect={handleBoardSelect}
                        />
                      ))}
                      {desktopBoardShowMoreButton}
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </AppShell.Section>
        <AppShell.Section px="xs">
          <Stack gap={6}>
            <NavLink
              component={Link}
              href={settingsHref}
              prefetch={false}
              active={active === 'settings'}
              aria-label="Settings"
              aria-current={active === 'settings' ? 'page' : undefined}
              onClick={closeMobile}
              label="Settings"
              leftSection={<IconSettings size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            <NavLink
              component={Link}
              href={apiKeysHref}
              prefetch={false}
              active={active === 'connections'}
              aria-label="Connections"
              aria-current={active === 'connections' ? 'page' : undefined}
              onClick={closeMobile}
              label="Connections"
              leftSection={<IconPlugConnected size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            {mobileAccountBlock}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main id="main-content" tabIndex={-1} className="workspace-main">
        {children}
      </AppShell.Main>

      {commandPaletteRequested ? (
        <CommandPalette
          openOnMount
          projectOptions={projectOptions}
          dashboardHref={dashboardHref}
          projectsHref={projectsHref}
          kanbanHref={effectiveKanbanHref}
          settingsHref={settingsHref}
          apiKeysHref={apiKeysHref}
        />
      ) : null}
    </AppShell>
  );
}
