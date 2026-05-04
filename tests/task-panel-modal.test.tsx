import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actionIconMock = vi.hoisted(() => vi.fn());
const modalMock = vi.hoisted(() => vi.fn());
const modalOverlayMock = vi.hoisted(() => vi.fn());
const resizableMock = vi.hoisted(() => vi.fn());
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
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: Object.assign(
    (props: {
      classNames?: {
        inner?: string;
      };
      centered?: boolean;
      children?: React.ReactNode;
      closeOnEscape?: boolean;
      fullScreen?: boolean;
      onClose?: () => void;
      onExitTransitionEnd?: () => void;
      size?: string;
    }) => {
      modalMock(props);

      return (
        <div
          data-testid="task-panel-modal"
          data-centered={String(Boolean(props.centered))}
          data-full-screen={String(Boolean(props.fullScreen))}
          data-size={props.size ?? ''}
          data-close-on-escape={String(Boolean(props.closeOnEscape))}
        >
          {props.children}
        </div>
      );
    },
    {
      Root: (props: {
        classNames?: { inner?: string };
        centered?: boolean;
        children?: React.ReactNode;
        closeOnEscape?: boolean;
        fullScreen?: boolean;
        onClose?: () => void;
        onExitTransitionEnd?: () => void;
        size?: string;
      }) => {
        modalMock(props);

        return (
          <div
            data-testid="task-panel-modal"
            data-centered={String(Boolean(props.centered))}
            data-full-screen={String(Boolean(props.fullScreen))}
            data-size={props.size ?? ''}
            data-close-on-escape={String(Boolean(props.closeOnEscape))}
          >
            {props.children}
          </div>
        );
      },
      Overlay: (props: { blur?: number; opacity?: number }) => {
        modalOverlayMock(props);

        return (
          <div
            data-testid="task-panel-modal-overlay"
            data-overlay-blur={String(props.blur ?? '')}
            data-overlay-opacity={String(props.opacity ?? '')}
          />
        );
      },
      Content: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div data-testid="task-panel-modal-content" {...props}>
          {children}
        </div>
      ),
      Header: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div data-testid="task-panel-modal-header" {...props}>
          {children}
        </div>
      ),
      Title: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div data-testid="task-panel-modal-title" {...props}>
          {children}
        </div>
      ),
      CloseButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button type="button" data-close-label={props['aria-label'] ?? ''} {...props} />
      ),
      Body: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div data-testid="task-panel-modal-body" {...props}>
          {children}
        </div>
      ),
    },
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('re-resizable', () => ({
  Resizable: (props: {
    children?: React.ReactNode;
    enable?: Record<string, boolean>;
    maxHeight?: number;
    maxWidth?: number;
    minHeight?: number;
    minWidth?: number;
    onResizeStop?: (
      event: unknown,
      direction: unknown,
      ref: { offsetWidth: number; offsetHeight: number },
    ) => void;
    size?: { width: number; height: number };
  }) => {
    resizableMock(props);

    return (
      <div
        data-testid="resizable-panel"
        data-width={String(props.size?.width ?? '')}
        data-height={String(props.size?.height ?? '')}
        data-min-width={String(props.minWidth ?? '')}
        data-min-height={String(props.minHeight ?? '')}
        data-max-width={String(props.maxWidth ?? '')}
        data-max-height={String(props.maxHeight ?? '')}
      >
        {props.children}
      </div>
    );
  },
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

import {
  clampTaskPanelSize,
  readTaskPanelStoredSize,
  resolveTaskPanelFullscreenState,
  TaskPanelModal,
} from '@/app/components/task-panel-modal';

describe('TaskPanelModal', () => {
  beforeEach(() => {
    actionIconMock.mockReset();
    modalMock.mockReset();
    modalOverlayMock.mockReset();
    resizableMock.mockReset();
    replaceMock.mockReset();
    useMediaQueryMock.mockReset();
    usePathnameMock.mockReset();
    useSearchParamsMock.mockReset();

    useMediaQueryMock.mockReturnValue(false);
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it('activates all edge and corner resize handles for desktop edit panels with a storage key', () => {
    const html = renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/board"
        size="80rem"
        resizableStorageKey="preqstation:task-edit-panel:size:v1"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-testid="resizable-panel"');
    expect(resizableMock.mock.calls[0]?.[0].enable).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
      topRight: true,
      bottomRight: true,
      bottomLeft: true,
      topLeft: true,
    });
  });

  it('does not activate resize for mobile or fullscreen modal states', () => {
    useMediaQueryMock.mockReturnValue(true);

    renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/board"
        size="80rem"
        resizableStorageKey="preqstation:task-edit-panel:size:v1"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(resizableMock).not.toHaveBeenCalled();

    useMediaQueryMock.mockReturnValue(false);
    useSearchParamsMock.mockReturnValue(new URLSearchParams('fullscreen=1'));

    renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/board"
        size="80rem"
        resizableStorageKey="preqstation:task-edit-panel:size:v1"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(resizableMock).not.toHaveBeenCalled();
  });

  it('ignores invalid stored panel sizes and clamps valid sizes to the viewport', () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
    };

    storage.set('panel-size', JSON.stringify({ width: 1800, height: 1200 }));
    expect(
      readTaskPanelStoredSize('panel-size', localStorageLike, { width: 1000, height: 700 }),
    ).toEqual({ width: 952, height: 652 });

    storage.set('panel-size', JSON.stringify({ width: 'wide', height: 650 }));
    expect(
      readTaskPanelStoredSize('panel-size', localStorageLike, { width: 1000, height: 700 }),
    ).toBeNull();

    expect(clampTaskPanelSize({ width: 300, height: 200 }, { width: 1600, height: 1000 })).toEqual({
      width: 720,
      height: 520,
    });
  });

  it('stores the clamped panel size when desktop resize stops', () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerWidth: 1000,
        innerHeight: 700,
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    try {
      renderToStaticMarkup(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/board"
          size="80rem"
          resizableStorageKey="preqstation:task-edit-panel:size:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      resizableMock.mock.calls[0]?.[0].onResizeStop?.(null, 'bottomRight', {
        offsetWidth: 1800,
        offsetHeight: 1200,
      });

      expect(storage.get('preqstation:task-edit-panel:size:v1')).toBe(
        JSON.stringify({ width: 952, height: 652 }),
      );
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('uses a centered desktop modal with the requested edit width and descriptive close label', () => {
    const html = renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/board" size="80rem">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-testid="task-panel-modal"');
    expect(html).toContain('data-centered="true"');
    expect(html).toContain('data-full-screen="false"');
    expect(html).toContain('data-size="80rem"');
    expect(html).toContain('data-close-label="Close Edit Task dialog"');
  });

  it('renders custom title content while keeping the close label tied to the plain dialog title', () => {
    const html = renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        titleContent={<div data-slot="task-edit-header-title">Edit task panel refresh</div>}
        closeHref="/board"
        size="80rem"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-slot="task-edit-header-title"');
    expect(html).toContain('data-close-label="Close Edit Task dialog"');
  });

  it('renders optional header center content in a dedicated centered slot', () => {
    const html = renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        titleContent={<div data-slot="task-edit-header-title">Edit task panel refresh</div>}
        headerCenterContent={<div data-slot="panel-save-status">Saved</div>}
        closeHref="/board"
        size="80rem"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-slot="task-edit-header-title"');
    expect(html).toContain('data-slot="panel-save-status"');
    expect(html).toMatch(/task-edit-header-title[\s\S]*panel-save-status/);
  });

  it('keeps the default desktop width for the new-task modal when no custom size is provided', () => {
    const html = renderToStaticMarkup(
      <TaskPanelModal opened={true} title="New Task" closeHref="/dashboard">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-full-screen="false"');
    expect(html).toContain('data-size="58rem"');
  });

  it('uses desktop full-screen mode when fullscreen=1 is present', () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=task-edit&taskId=PROJ-335&fullscreen=1'),
    );

    const html = renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-full-screen="true"');
    expect(html).toContain('data-centered="true"');
    expect(html).toContain('data-size="100%"');
    expect(html).toContain('aria-label="Exit full screen for Edit Task dialog"');
  });

  it('uses optimistic desktop fullscreen state while URL params are stale', () => {
    expect(
      resolveTaskPanelFullscreenState({
        isMobile: false,
        optimisticDesktopFullScreen: true,
        urlDesktopFullScreen: false,
      }),
    ).toEqual({ isDesktopFullScreen: true, modalFullScreen: true });

    expect(
      resolveTaskPanelFullscreenState({
        isMobile: false,
        optimisticDesktopFullScreen: false,
        urlDesktopFullScreen: true,
      }),
    ).toEqual({ isDesktopFullScreen: false, modalFullScreen: false });

    expect(
      resolveTaskPanelFullscreenState({
        isMobile: true,
        optimisticDesktopFullScreen: false,
        urlDesktopFullScreen: true,
      }),
    ).toEqual({ isDesktopFullScreen: false, modalFullScreen: true });
  });

  it('adds and removes fullscreen=1 without dropping other query params', () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams('panel=task-edit&taskId=PROJ-335'));

    renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    let actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
      | React.ButtonHTMLAttributes<HTMLButtonElement>
      | undefined;

    actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);

    expect(replaceMock).toHaveBeenCalledWith(
      '/dashboard?panel=task-edit&taskId=PROJ-335&fullscreen=1',
    );

    actionIconMock.mockReset();
    replaceMock.mockReset();
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=task-edit&taskId=PROJ-335&fullscreen=1'),
    );

    renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
      | React.ButtonHTMLAttributes<HTMLButtonElement>
      | undefined;

    actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);

    expect(replaceMock).toHaveBeenCalledWith('/dashboard?panel=task-edit&taskId=PROJ-335');
  });

  it('falls back to a full-screen mobile modal', () => {
    useMediaQueryMock.mockReturnValue(true);

    const html = renderToStaticMarkup(
      <TaskPanelModal opened={true} title="New Task" closeHref="/dashboard">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-full-screen="true"');
    expect(html).toContain('data-centered="false"');
    expect(html).toContain('data-size="100%"');
  });

  it('uses a blurred overlay and waits for the exit transition before replacing the route', () => {
    renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/board" size="80rem">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    const props = modalMock.mock.calls[0]?.[0];
    props?.onClose?.();

    expect(modalOverlayMock).toHaveBeenCalledWith({ opacity: 0.55, blur: 18 });
    expect(replaceMock).not.toHaveBeenCalled();

    props?.onExitTransitionEnd?.();

    expect(replaceMock).toHaveBeenCalledWith('/board');
  });

  it('defers route replace until the exit transition ends', () => {
    renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/board">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    const props = modalMock.mock.calls[0]?.[0];
    props?.onClose?.();

    expect(replaceMock).not.toHaveBeenCalled();

    props?.onExitTransitionEnd?.();

    expect(replaceMock).toHaveBeenCalledWith('/board');
  });

  it('defers a provided onClose callback until the exit transition ends', () => {
    const onClose = vi.fn();

    renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/board" onClose={onClose}>
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    const props = modalMock.mock.calls[0]?.[0];
    props?.onClose?.();

    expect(onClose).not.toHaveBeenCalled();

    props?.onExitTransitionEnd?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps desktop fullscreen inside the shared animated wrapper', () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=task-edit&taskId=PROJ-335&fullscreen=1'),
    );

    renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/dashboard">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    const props = modalMock.mock.calls[0]?.[0];

    expect(props.fullScreen).toBe(true);
    expect(props.centered).toBe(true);
    expect(props.classNames?.inner).toBeTruthy();
  });

  it('keeps escape-close enabled by default', () => {
    useMediaQueryMock.mockReturnValue(false);

    const html = renderToStaticMarkup(
      <TaskPanelModal opened={true} title="Edit Task" closeHref="/board" size="80rem">
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-close-on-escape="true"');
  });

  it('allows callers to disable escape-close explicitly', () => {
    useMediaQueryMock.mockReturnValue(false);

    const html = renderToStaticMarkup(
      <TaskPanelModal
        opened={true}
        title="Edit Task"
        closeHref="/board"
        size="80rem"
        closeOnEscape={false}
      >
        <div>Panel content</div>
      </TaskPanelModal>,
    );

    expect(html).toContain('data-close-on-escape="false"');
  });
});
