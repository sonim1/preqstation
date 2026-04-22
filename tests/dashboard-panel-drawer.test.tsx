import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actionIconMock = vi.hoisted(() => vi.fn());
const useMediaQueryMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn());
const useSearchParamsMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock('@mantine/core', () => ({
  ActionIcon: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    actionIconMock(props);
    return (
      <button type="button" {...props}>
        {props.children}
      </button>
    );
  },
  Drawer: ({
    size,
    title,
    children,
    closeButtonProps,
  }: {
    size: string;
    title?: React.ReactNode;
    children: React.ReactNode;
    closeButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  }) => (
    <div data-testid="drawer" data-size={size}>
      <div data-testid="drawer-title">{title}</div>
      <button type="button" {...closeButtonProps}>
        Close
      </button>
      {children}
    </div>
  ),
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@mantine/hooks', () => ({
  useMediaQuery: () => useMediaQueryMock(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => useSearchParamsMock(),
}));

import { DashboardPanelDrawer } from '@/app/components/dashboard-panel-drawer';

describe('DashboardPanelDrawer', () => {
  beforeEach(() => {
    actionIconMock.mockReset();
    replaceMock.mockReset();
    useMediaQueryMock.mockReset();
    usePathnameMock.mockReset();
    useSearchParamsMock.mockReset();

    useMediaQueryMock.mockReturnValue(false);
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it('uses the provided desktop size when one is supplied', () => {
    const html = renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="Edit Task" closeHref="/board" size="58rem">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    expect(html).toContain('data-size="58rem"');
  });

  it('keeps the mobile drawer full width even when a custom size is supplied', () => {
    useMediaQueryMock.mockReturnValue(true);

    const html = renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="Edit Task" closeHref="/board" size="58rem">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    expect(html).toContain('data-size="100%"');
  });

  it('derives a descriptive close label from the drawer title', () => {
    const html = renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="New Project" closeHref="/dashboard">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    expect(html).toContain('aria-label="Close New Project panel"');
  });

  it('uses full viewport width on desktop when fullscreen=1 is present', () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=project-edit&projectId=1&fullscreen=1'),
    );

    const html = renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="Edit Project" closeHref="/dashboard">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    expect(html).toContain('data-size="100%"');
    expect(html).toContain('aria-label="Exit full screen for Edit Project panel"');
  });

  it('adds and removes fullscreen=1 without dropping other drawer params', () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams('panel=project-edit&projectId=1'));

    renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="Edit Project" closeHref="/dashboard">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    let actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
      | React.ButtonHTMLAttributes<HTMLButtonElement>
      | undefined;

    actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);

    expect(replaceMock).toHaveBeenCalledWith(
      '/dashboard?panel=project-edit&projectId=1&fullscreen=1',
    );

    actionIconMock.mockReset();
    replaceMock.mockReset();
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=project-edit&projectId=1&fullscreen=1'),
    );

    renderToStaticMarkup(
      <DashboardPanelDrawer opened={true} title="Edit Project" closeHref="/dashboard">
        <div>Panel content</div>
      </DashboardPanelDrawer>,
    );

    actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
      | React.ButtonHTMLAttributes<HTMLButtonElement>
      | undefined;

    actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);

    expect(replaceMock).toHaveBeenCalledWith('/dashboard?panel=project-edit&projectId=1');
  });
});
