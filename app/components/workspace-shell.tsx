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
  IconChevronLeft,
  IconChevronRight,
  IconFolders,
  IconHome2,
  IconLayoutKanban,
  IconPlugConnected,
  IconSettings,
} from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { outfit } from '@/app/fonts';
import { PAUSED_PROJECT_STATUS } from '@/lib/project-meta';
import {
  findProjectByKey,
  findVisibleProjectByKey,
  getProjectSelectHref,
  getWorkspaceProjectSubtitle,
  isVisibleWorkspaceProject,
  LAST_PROJECT_KEY_STORAGE,
  pushRecentProjectKey,
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
const BOARD_SUBNAV_ROW_HEIGHT = 44;
const BOARD_SUBNAV_ROW_GAP = 4;

type BoardNavLinkProps = {
  project: WorkspaceProjectOption;
  isCurrentBoard: boolean;
  onSelect: (projectKey: string) => void;
};

function BoardNavLink({ project, isCurrentBoard, onSelect }: BoardNavLinkProps) {
  return (
    <NavLink
      component={Link}
      href={`/board/${project.projectKey}`}
      prefetch={false}
      label={
        <span className="workspace-board-subnav-label">
          <span className="workspace-board-subnav-name">{project.name}</span>
        </span>
      }
      onClick={() => {
        onSelect(project.projectKey);
      }}
      className="workspace-nav-link workspace-board-subnav-link"
      data-current-board={isCurrentBoard ? 'true' : undefined}
      aria-current={isCurrentBoard ? 'page' : undefined}
    />
  );
}

function partitionWorkspaceProjectOptions(projectOptions: WorkspaceProjectOption[]) {
  const visibleProjectOptions: WorkspaceProjectOption[] = [];
  const pausedProjectOptions: WorkspaceProjectOption[] = [];

  for (const project of projectOptions) {
    if (project.status === PAUSED_PROJECT_STATUS) {
      pausedProjectOptions.push(project);
      continue;
    }

    if (isVisibleWorkspaceProject(project)) {
      visibleProjectOptions.push(project);
    }
  }

  return { visibleProjectOptions, pausedProjectOptions };
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

function subscribeRememberedProjectKey(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LAST_PROJECT_KEY_STORAGE) return;
    onStoreChange();
  };

  const onCustomEvent = () => {
    onStoreChange();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(PROJECT_KEY_CHANGED_EVENT, onCustomEvent);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(PROJECT_KEY_CHANGED_EVENT, onCustomEvent);
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
  const [pausedBoardsRequested, setPausedBoardsRequested] = useState(false);
  const rememberedProjectKey = useSyncExternalStore(
    subscribeRememberedProjectKey,
    readRememberedProjectKey,
    () => null,
  );
  const { visibleProjectOptions, pausedProjectOptions } = useMemo(
    () => partitionWorkspaceProjectOptions(projectOptions),
    [projectOptions],
  );

  const pickerState = useMemo(
    () =>
      resolvePickerProject({
        pathname,
        rememberedProjectKey,
        projectOptions,
      }),
    [pathname, rememberedProjectKey, projectOptions],
  );
  const selectedProject = pickerState.project;
  const effectiveKanbanHref = useMemo(
    () => resolveWorkspaceKanbanHref(kanbanHref, rememberedProjectKey, projectOptions),
    [kanbanHref, rememberedProjectKey, projectOptions],
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
  const currentVisibleBoardProject =
    currentBoardProject && isVisibleWorkspaceProject(currentBoardProject)
      ? currentBoardProject
      : null;
  const currentPausedBoardProject =
    currentBoardProject?.status === PAUSED_PROJECT_STATUS ? currentBoardProject : null;
  const currentBoardIndex = currentVisibleBoardProject
    ? visibleProjectOptions.findIndex((project) => project.id === currentVisibleBoardProject.id)
    : -1;
  const pausedBoardsOpened = pausedBoardsRequested || !!currentPausedBoardProject;
  const isBoardContext = active === 'kanban';
  const currentScopeLabel = mobilePickerProject?.name || 'Boards';
  const workspaceSubtitle = getWorkspaceProjectSubtitle(currentBoardProject);
  const projectFilterAriaLabel = `${isBoardContext ? 'Board picker' : 'Project picker'}. Current: ${currentScopeLabel}`;
  const boardSelectionSurfaceStyle = {
    height: `${BOARD_SUBNAV_ROW_HEIGHT}px`,
    transform: `translateY(${Math.max(currentBoardIndex, 0) * (BOARD_SUBNAV_ROW_HEIGHT + BOARD_SUBNAV_ROW_GAP)}px)`,
    opacity: currentBoardIndex === -1 ? 0 : 1,
  };
  const handleBoardSelect = useCallback(
    (projectKey: string) => {
      writeRememberedProjectKey(projectKey);
      closeMobile();
    },
    [closeMobile],
  );
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

    const project = findProjectByKey(projectOptions, projectKey);
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
    if (findProjectByKey(projectOptions, rememberedProjectKey)) return;
    writeRememberedProjectKey(null);
  }, [rememberedProjectKey, projectOptions]);

  // Redirect /board → /board/{projectKey} when a remembered project exists
  useEffect(() => {
    if (pathname !== '/board') return;
    const project = findVisibleProjectByKey(projectOptions, rememberedProjectKey);
    if (!project) return;
    router.replace(`/board/${project.projectKey}`);
  }, [pathname, rememberedProjectKey, projectOptions, router]);

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
          projectOptions={projectOptions}
          selectedProjectId={mobilePickerProject?.id ?? null}
          onSelect={handleProjectSelect}
        />
      </Menu.Dropdown>
    </Menu>
  );
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
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      header={{ height: 56 }}
      className="workspace-shell"
    >
      <AppShell.Header className="workspace-header">
        <Group justify="space-between" h="100%" wrap="nowrap" className="workspace-header-inner">
          <Group gap="sm" wrap="nowrap" className="workspace-header-start">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label={mobileOpened ? 'Close navigation' : 'Open navigation'}
            />
            {!desktopOpened ? (
              <ActionIcon
                visibleFrom="sm"
                size={44}
                radius="xl"
                variant="default"
                className="workspace-header-sidebar-toggle"
                aria-label="Expand navigation"
                onClick={toggleDesktop}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            ) : null}
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
          </Group>

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

      <AppShell.Navbar className="workspace-navbar">
        <AppShell.Section grow component={ScrollArea} px="xs">
          <Stack gap={6} py="xs">
            <NavLink
              component={Link}
              href={dashboardHref}
              prefetch={false}
              active={active === 'dashboard'}
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
              aria-current={active === 'projects' ? 'page' : undefined}
              onClick={closeMobile}
              label="Projects"
              leftSection={<IconFolders size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            <NavLink
              component={Link}
              href={effectiveKanbanHref}
              prefetch={false}
              active={active === 'kanban'}
              aria-current={active === 'kanban' ? 'page' : undefined}
              onClick={closeMobile}
              label="Boards"
              leftSection={<IconLayoutKanban size={16} />}
              rightSection={null}
              className="workspace-nav-link"
            />
            <Box visibleFrom="md">
              <Stack gap={6}>
                {visibleProjectOptions.length > 0 ? (
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
                    {visibleProjectOptions.map((project) => (
                      <BoardNavLink
                        key={project.id}
                        project={project}
                        isCurrentBoard={currentVisibleBoardProject?.id === project.id}
                        onSelect={handleBoardSelect}
                      />
                    ))}
                  </Stack>
                ) : null}
                {pausedProjectOptions.length > 0 ? (
                  <Stack gap={BOARD_SUBNAV_ROW_GAP} className="workspace-board-subnav">
                    <NavLink
                      label="Paused"
                      onClick={() => {
                        setPausedBoardsRequested((opened) => !opened);
                      }}
                      className="workspace-nav-link workspace-board-subnav-link workspace-board-subnav-toggle"
                      data-open={pausedBoardsOpened ? 'true' : undefined}
                      aria-expanded={pausedBoardsOpened}
                      aria-controls="workspace-paused-board-group"
                      rightSection={
                        <IconChevronRight
                          size={14}
                          className="workspace-board-subnav-toggle-icon"
                        />
                      }
                    />
                    {pausedBoardsOpened ? (
                      <Stack
                        gap={BOARD_SUBNAV_ROW_GAP}
                        id="workspace-paused-board-group"
                        className="workspace-board-subnav-children"
                      >
                        {pausedProjectOptions.map((project) => (
                          <BoardNavLink
                            key={project.id}
                            project={project}
                            isCurrentBoard={currentPausedBoardProject?.id === project.id}
                            onSelect={handleBoardSelect}
                          />
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </AppShell.Section>
        <AppShell.Section px="xs" pb="xs">
          <Stack gap={6}>
            <NavLink
              component={Link}
              href={settingsHref}
              prefetch={false}
              active={active === 'settings'}
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

      <AppShell.Main className="workspace-main">
        {desktopOpened ? (
          <div className="workspace-divider-rail">
            <ActionIcon
              size={44}
              radius="xl"
              variant="default"
              className="workspace-divider-rail-button"
              aria-label="Collapse navigation"
              onClick={toggleDesktop}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
          </div>
        ) : null}
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
