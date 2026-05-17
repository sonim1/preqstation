'use client';

import { Button, type ButtonProps } from '@mantine/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type ComponentProps,
  createContext,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
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
};

type ProjectDetailEditPanelButtonProps = ButtonProps & {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const ProjectDetailEditPanelContext = createContext<ProjectDetailEditPanelContextValue | null>(
  null,
);

function buildPanelHref(
  pathname: string,
  searchParams: { toString: () => string },
  panel: string | null,
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  if (panel) {
    nextParams.set('panel', panel);
  } else {
    nextParams.delete('panel');
  }
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ProjectDetailEditPanelProvider({
  children,
  closeHref,
  ...modalProps
}: ProjectDetailEditPanelProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const opened = searchParams.get('panel') === 'project-edit';
  const openHref = useMemo(
    () => buildPanelHref(pathname, searchParams, 'project-edit'),
    [pathname, searchParams],
  );
  const closePanelHref = useMemo(() => {
    const nextHref = buildPanelHref(pathname, searchParams, null);
    return nextHref || closeHref;
  }, [closeHref, pathname, searchParams]);

  const openPanel = useCallback(() => {
    router.push(openHref, { scroll: false });
  }, [openHref, router]);

  const closePanel = useCallback(() => {
    router.replace(closePanelHref, { scroll: false });
  }, [closePanelHref, router]);

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
