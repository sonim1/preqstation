'use client';

import { Button, type ButtonProps } from '@mantine/core';
import {
  type ComponentProps,
  createContext,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ProjectEditModal } from '@/app/components/project-edit-modal';

type ProjectDetailEditPanelContextValue = {
  openPanel: () => void;
};

type ProjectDetailEditPanelProviderProps = Omit<
  ComponentProps<typeof ProjectEditModal>,
  'opened' | 'onClose'
> & {
  children: ReactNode;
  editHref: string;
  initialOpened: boolean;
};

type ProjectDetailEditPanelButtonProps = ButtonProps & {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const ProjectDetailEditPanelContext = createContext<ProjectDetailEditPanelContextValue | null>(
  null,
);

function normalizeHref(href: string) {
  if (typeof window === 'undefined') return href;
  const url = new URL(href, window.location.origin);
  return `${url.pathname}${url.search}${url.hash}`;
}

function currentHref() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function panelIsOpenFromLocation() {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('panel') === 'project-edit';
}

function updateHistory(href: string, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  const nextHref = normalizeHref(href);
  if (currentHref() === nextHref) return;

  if (mode === 'push') {
    window.history.pushState(null, '', nextHref);
  } else {
    window.history.replaceState(null, '', nextHref);
  }
}

export function ProjectDetailEditPanelProvider({
  children,
  editHref,
  initialOpened,
  closeHref,
  ...modalProps
}: ProjectDetailEditPanelProviderProps) {
  const [opened, setOpened] = useState(initialOpened);

  useEffect(() => {
    const syncFromHistory = () => setOpened(panelIsOpenFromLocation());

    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);

  const openPanel = useCallback(() => {
    setOpened(true);
    updateHistory(editHref, 'push');
  }, [editHref]);

  const closePanel = useCallback(() => {
    setOpened(false);
    updateHistory(closeHref, 'replace');
  }, [closeHref]);

  const contextValue = useMemo(() => ({ openPanel }), [openPanel]);

  return (
    <ProjectDetailEditPanelContext.Provider value={contextValue}>
      {children}
      {opened ? (
        <ProjectEditModal
          {...modalProps}
          opened={opened}
          closeHref={closeHref}
          onClose={closePanel}
        />
      ) : null}
    </ProjectDetailEditPanelContext.Provider>
  );
}

export function ProjectDetailEditPanelButton({
  children,
  onClick,
  ...props
}: ProjectDetailEditPanelButtonProps) {
  const context = useContext(ProjectDetailEditPanelContext);

  if (!context) {
    throw new Error(
      'ProjectDetailEditPanelButton must be used inside ProjectDetailEditPanelProvider.',
    );
  }

  return (
    <Button
      {...props}
      type="button"
      data-project-edit-panel-trigger="true"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        context.openPanel();
      }}
    >
      {children}
    </Button>
  );
}
