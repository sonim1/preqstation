import { createRequire } from 'node:module';

import { act, cleanup, render, waitFor } from '@testing-library/react';
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
      Content: ({
        children,
        classNames: _classNames,
        styles: _styles,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & { classNames?: unknown; styles?: unknown }) => (
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
      delta: { width: number; height: number },
    ) => void;
    onResizeStart?: (
      event: unknown,
      direction: unknown,
      ref: { offsetWidth: number; offsetHeight: number },
    ) => void;
    onResize?: (
      event: unknown,
      direction: unknown,
      ref: { offsetWidth: number; offsetHeight: number; style: CSSStyleDeclaration },
      delta: { width: number; height: number },
    ) => void;
    size?: { width: number; height: number };
    style?: React.CSSProperties;
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
        data-left={String(props.style?.left ?? '')}
        data-top={String(props.style?.top ?? '')}
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
  calculateTaskPanelResizeOffset,
  clampTaskPanelResizeOffset,
  clampTaskPanelSize,
  readTaskPanelStoredSize,
  resolveTaskPanelFullscreenState,
  TaskPanelModal,
} from '@/app/components/task-panel-modal';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (
    html?: string,
    options?: { url?: string },
  ) => {
    window: Window & typeof globalThis;
  };
};

function installDom({ width, height }: { width: number; height: number }) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalEvent = globalThis.Event;
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://preqstation.test/dashboard',
  });

  Object.defineProperty(dom.window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(dom.window, 'innerHeight', {
    configurable: true,
    value: height,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: dom.window,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: dom.window.document,
  });
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: dom.window.HTMLElement,
  });
  Object.defineProperty(globalThis, 'Event', {
    configurable: true,
    value: dom.window.Event,
  });

  return {
    resizeTo(width: number, height: number) {
      Object.defineProperty(dom.window, 'innerWidth', {
        configurable: true,
        value: width,
      });
      Object.defineProperty(dom.window, 'innerHeight', {
        configurable: true,
        value: height,
      });
    },
    restore() {
      dom.window.close();
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      });
      Object.defineProperty(globalThis, 'HTMLElement', {
        configurable: true,
        value: originalHTMLElement,
      });
      Object.defineProperty(globalThis, 'Event', {
        configurable: true,
        value: originalEvent,
      });
    },
  };
}

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

  it('does not activate resize while the mobile media query is unresolved', () => {
    useMediaQueryMock.mockReturnValue(null);

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

  it('clamps desktop resize bounds to the workspace main wrapper when it is narrower than the viewport', async () => {
    const dom = installDom({ width: 1400, height: 900 });
    const workspaceMain = document.createElement('main');
    workspaceMain.className = 'workspace-main';
    workspaceMain.getBoundingClientRect = () =>
      ({
        width: 960,
        height: 700,
        top: 56,
        right: 1200,
        bottom: 756,
        left: 240,
        x: 240,
        y: 56,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(workspaceMain);
    window.localStorage.setItem(
      'preqstation:task-edit-panel:size:v1',
      JSON.stringify({ width: 1300, height: 850 }),
    );

    try {
      render(
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

      await waitFor(() => {
        const latestResizableProps = resizableMock.mock.calls.at(-1)?.[0];

        expect(latestResizableProps.maxWidth).toBe(912);
        expect(latestResizableProps.maxHeight).toBe(652);
        expect(latestResizableProps.size).toEqual({ width: 912, height: 652 });
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('stores the clamped panel size when desktop resize stops', () => {
    const dom = installDom({ width: 1000, height: 700 });

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

      resizableMock.mock.calls[0]?.[0].onResizeStop?.(
        null,
        'bottomRight',
        {
          offsetWidth: 1800,
          offsetHeight: 1200,
        },
        {
          width: 1080,
          height: 680,
        },
      );

      expect(window.localStorage.getItem('preqstation:task-edit-panel:size:v1')).toBe(
        JSON.stringify({ width: 952, height: 652 }),
      );
    } finally {
      dom.restore();
    }
  });

  it('updates the panel offset directly on the resizing element during desktop resize', () => {
    const dom = installDom({ width: 1000, height: 700 });

    try {
      render(
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

      const resizeRef = document.createElement('div');

      resizableMock.mock.calls[0]?.[0].onResizeStart?.(null, 'bottomRight', {
        offsetWidth: 720,
        offsetHeight: 520,
      });
      resizableMock.mock.calls[0]?.[0].onResize?.(null, 'bottomRight', resizeRef, {
        width: 120,
        height: 80,
      });

      expect(resizeRef.style.left).toBe('60px');
      expect(resizeRef.style.top).toBe('40px');
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('offsets the resizable panel so the opposite edge stays pinned', () => {
    expect(
      calculateTaskPanelResizeOffset({ x: 0, y: 0 }, 'left', { width: 120, height: 0 }),
    ).toEqual({ x: -60, y: 0 });
    expect(
      calculateTaskPanelResizeOffset({ x: 0, y: 0 }, 'right', { width: 120, height: 0 }),
    ).toEqual({ x: 60, y: 0 });
    expect(
      calculateTaskPanelResizeOffset({ x: 10, y: 10 }, 'top', { width: 0, height: 80 }),
    ).toEqual({ x: 10, y: -30 });
    expect(
      calculateTaskPanelResizeOffset({ x: 10, y: 10 }, 'bottomLeft', {
        width: 120,
        height: 80,
      }),
    ).toEqual({ x: -50, y: 50 });
  });

  it('clamps resize offsets inside the available viewport gutter', () => {
    expect(
      clampTaskPanelResizeOffset(
        { x: 140, y: -120 },
        { width: 720, height: 520 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({ x: 116, y: -66 });
    expect(
      clampTaskPanelResizeOffset(
        { x: 60, y: 40 },
        { width: 720, height: 520 },
        { width: 760, height: 560 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it('uses a stable fallback size for the first render and hydrates stored size after mount', async () => {
    const dom = installDom({ width: 1000, height: 700 });
    window.localStorage.setItem(
      'preqstation:task-edit-panel:size:v1',
      JSON.stringify({ width: 900, height: 650 }),
    );

    try {
      render(
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

      expect(resizableMock.mock.calls[0]?.[0].size).toEqual({ width: 1280, height: 720 });
      await waitFor(() => {
        expect(resizableMock.mock.calls.at(-1)?.[0].size).toEqual({ width: 900, height: 650 });
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('hydrates stored size when resize becomes enabled after a fullscreen mount', async () => {
    const dom = installDom({ width: 1000, height: 700 });
    window.localStorage.setItem(
      'preqstation:task-edit-panel:size:v1',
      JSON.stringify({ width: 900, height: 650 }),
    );
    useSearchParamsMock.mockReturnValue(new URLSearchParams('fullscreen=1'));

    try {
      const { rerender } = render(
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

      useSearchParamsMock.mockReturnValue(new URLSearchParams());
      rerender(
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

      await waitFor(() => {
        expect(resizableMock.mock.calls.at(-1)?.[0].size).toEqual({ width: 900, height: 650 });
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('resets the resize offset when returning from fullscreen', async () => {
    const dom = installDom({ width: 1000, height: 700 });

    try {
      const { rerender } = render(
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

      act(() => {
        resizableMock.mock.calls[0]?.[0].onResizeStop?.(
          null,
          'bottomRight',
          {
            offsetWidth: 720,
            offsetHeight: 520,
          },
          {
            width: 120,
            height: 80,
          },
        );
      });

      await waitFor(() => {
        expect(resizableMock.mock.calls.at(-1)?.[0].style).toEqual({ left: 60, top: 40 });
      });

      await act(async () => {
        useSearchParamsMock.mockReturnValue(new URLSearchParams('fullscreen=1'));
        rerender(
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
      });

      await act(async () => {
        useSearchParamsMock.mockReturnValue(new URLSearchParams());
        rerender(
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
      });

      await waitFor(() => {
        expect(resizableMock.mock.calls.at(-1)?.[0].style).toEqual({ left: 0, top: 0 });
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('updates resize bounds and clamps the panel size when the viewport changes', () => {
    const dom = installDom({ width: 1400, height: 900 });

    try {
      render(
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

      dom.resizeTo(900, 650);

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const latestResizableProps = resizableMock.mock.calls.at(-1)?.[0];

      expect(latestResizableProps.maxWidth).toBe(852);
      expect(latestResizableProps.maxHeight).toBe(602);
      expect(latestResizableProps.size).toEqual({ width: 852, height: 602 });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('clamps the panel offset when the viewport changes after a desktop resize', async () => {
    const dom = installDom({ width: 1000, height: 700 });

    try {
      render(
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

      act(() => {
        resizableMock.mock.calls[0]?.[0].onResizeStop?.(
          null,
          'bottomRight',
          {
            offsetWidth: 720,
            offsetHeight: 520,
          },
          {
            width: 120,
            height: 80,
          },
        );
      });

      await waitFor(() => {
        expect(resizableMock.mock.calls.at(-1)?.[0].style).toEqual({ left: 60, top: 40 });
      });

      dom.resizeTo(760, 560);

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        const latestResizableProps = resizableMock.mock.calls.at(-1)?.[0];

        expect(latestResizableProps.size).toEqual({ width: 720, height: 520 });
        expect(latestResizableProps.style).toEqual({ left: 0, top: 0 });
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('updates resize bounds when the workspace main wrapper changes size', () => {
    const dom = installDom({ width: 1400, height: 900 });
    const originalResizeObserver = globalThis.ResizeObserver;
    let workspaceSize = { width: 1200, height: 800 };
    let resizeObserverCallback: ResizeObserverCallback | null = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const workspaceMain = document.createElement('main');
    workspaceMain.className = 'workspace-main';
    workspaceMain.getBoundingClientRect = () =>
      ({
        width: workspaceSize.width,
        height: workspaceSize.height,
        top: 56,
        right: 1200,
        bottom: 856,
        left: 0,
        x: 0,
        y: 56,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(workspaceMain);

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    });

    try {
      render(
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

      expect(observeMock).toHaveBeenCalledWith(workspaceMain);

      workspaceSize = { width: 900, height: 650 };

      act(() => {
        resizeObserverCallback?.([], {} as ResizeObserver);
      });

      const latestResizableProps = resizableMock.mock.calls.at(-1)?.[0];

      expect(latestResizableProps.maxWidth).toBe(852);
      expect(latestResizableProps.maxHeight).toBe(602);
      expect(latestResizableProps.size).toEqual({ width: 852, height: 602 });
    } finally {
      cleanup();
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
      dom.restore();
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

  it('restores stored desktop fullscreen when the URL does not include fullscreen=1', async () => {
    const dom = installDom({ width: 1000, height: 700 });
    window.localStorage.setItem('preqstation:task-edit-panel:fullscreen:v1', 'true');

    try {
      render(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      await waitFor(() => {
        expect(modalMock.mock.calls.at(-1)?.[0].fullScreen).toBe(true);
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('lets fullscreen=1 override a stored desktop fullscreen preference', async () => {
    const dom = installDom({ width: 1000, height: 700 });
    window.localStorage.setItem('preqstation:task-edit-panel:fullscreen:v1', 'false');
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=task-edit&taskId=PROJ-335&fullscreen=1'),
    );

    try {
      render(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      await waitFor(() => {
        expect(modalMock.mock.calls.at(-1)?.[0].fullScreen).toBe(true);
      });
    } finally {
      cleanup();
      dom.restore();
    }
  });

  it('uses optimistic desktop fullscreen state while URL params are stale', () => {
    expect(
      resolveTaskPanelFullscreenState({
        isMobile: false,
        optimisticDesktopFullScreen: true,
        storedDesktopFullScreen: null,
        urlDesktopFullScreen: false,
      }),
    ).toEqual({ isDesktopFullScreen: true, modalFullScreen: true });

    expect(
      resolveTaskPanelFullscreenState({
        isMobile: false,
        optimisticDesktopFullScreen: false,
        storedDesktopFullScreen: null,
        urlDesktopFullScreen: true,
      }),
    ).toEqual({ isDesktopFullScreen: false, modalFullScreen: false });

    expect(
      resolveTaskPanelFullscreenState({
        isMobile: true,
        optimisticDesktopFullScreen: false,
        storedDesktopFullScreen: true,
        urlDesktopFullScreen: true,
      }),
    ).toEqual({ isDesktopFullScreen: false, modalFullScreen: true });
  });

  it('adds and removes fullscreen=1 without dropping other query params', () => {
    const dom = installDom({ width: 1000, height: 700 });
    useSearchParamsMock.mockReturnValue(new URLSearchParams('panel=task-edit&taskId=PROJ-335'));

    try {
      renderToStaticMarkup(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
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
      expect(window.localStorage.getItem('preqstation:task-edit-panel:fullscreen:v1')).toBe('true');

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
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
        | React.ButtonHTMLAttributes<HTMLButtonElement>
        | undefined;

      actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);

      expect(replaceMock).toHaveBeenCalledWith('/dashboard?panel=task-edit&taskId=PROJ-335');
      expect(window.localStorage.getItem('preqstation:task-edit-panel:fullscreen:v1')).toBe(
        'false',
      );
    } finally {
      dom.restore();
    }
  });

  it('keeps desktop fullscreen off after exit when storage persistence fails', async () => {
    const dom = installDom({ width: 1000, height: 700 });
    window.localStorage.setItem('preqstation:task-edit-panel:fullscreen:v1', 'true');
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('panel=task-edit&taskId=PROJ-335&fullscreen=1'),
    );
    const setItemSpy = vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    try {
      const { rerender } = render(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      await waitFor(() => {
        expect(modalMock.mock.calls.at(-1)?.[0].fullScreen).toBe(true);
      });

      const actionIconProps = actionIconMock.mock.calls.at(-1)?.[0] as
        | React.ButtonHTMLAttributes<HTMLButtonElement>
        | undefined;

      await act(async () => {
        actionIconProps?.onClick?.({ preventDefault() {} } as React.MouseEvent<HTMLButtonElement>);
      });

      expect(replaceMock).toHaveBeenCalledWith('/dashboard?panel=task-edit&taskId=PROJ-335');
      expect(window.localStorage.getItem('preqstation:task-edit-panel:fullscreen:v1')).toBe(
        'true',
      );

      useSearchParamsMock.mockReturnValue(new URLSearchParams('panel=task-edit&taskId=PROJ-335'));
      rerender(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard?panel=task-edit&taskId=PROJ-335"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      await waitFor(() => {
        expect(modalMock.mock.calls.at(-1)?.[0].fullScreen).toBe(false);
      });
    } finally {
      setItemSpy.mockRestore();
      cleanup();
      dom.restore();
    }
  });

  it('ignores stored desktop fullscreen on mobile', () => {
    const dom = installDom({ width: 390, height: 844 });
    window.localStorage.setItem('preqstation:task-edit-panel:fullscreen:v1', 'true');
    useMediaQueryMock.mockReturnValue(true);

    try {
      const html = renderToStaticMarkup(
        <TaskPanelModal
          opened={true}
          title="Edit Task"
          closeHref="/dashboard"
          fullscreenStorageKey="preqstation:task-edit-panel:fullscreen:v1"
        >
          <div>Panel content</div>
        </TaskPanelModal>,
      );

      expect(html).toContain('data-full-screen="true"');
      expect(html).not.toContain('Exit full screen for Edit Task dialog');
    } finally {
      dom.restore();
    }
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
