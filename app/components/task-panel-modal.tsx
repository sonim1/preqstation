'use client';

import { ActionIcon, Group, Modal, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMaximize, IconMinimize, IconX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type Enable,
  type HandleClassName,
  type NumberSize,
  Resizable,
  type ResizeDirection,
} from 're-resizable';
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';

import classes from './task-panel-modal.module.css';

const HEADER_ACTION_COLOR = 'var(--ui-text)';
const HEADER_ACTION_ICON_SIZE = 16;
const HEADER_ACTION_SIZE = 28;
const HEADER_ACTION_STROKE = 1.8;
const TASK_PANEL_RESIZE_MIN_WIDTH = 720;
const TASK_PANEL_RESIZE_MIN_HEIGHT = 520;
const TASK_PANEL_RESIZE_VIEWPORT_GUTTER = 48;
const TASK_PANEL_RESIZE_DEFAULT_SIZE = { width: 1280, height: 720 };
const TASK_PANEL_RESIZE_FALLBACK_VIEWPORT = { width: 1440, height: 900 };
const TASK_PANEL_RESIZE_BOUNDARY_SELECTOR = '.workspace-main';
const TASK_PANEL_RESIZE_ENABLE: Enable = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
};
const TASK_PANEL_RESIZE_HANDLE_CLASSES: HandleClassName = {
  top: classes.resizeHandleTop,
  right: classes.resizeHandleRight,
  bottom: classes.resizeHandleBottom,
  left: classes.resizeHandleLeft,
  topRight: classes.resizeHandleTopRight,
  bottomRight: classes.resizeHandleBottomRight,
  bottomLeft: classes.resizeHandleBottomLeft,
  topLeft: classes.resizeHandleTopLeft,
};

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type TaskPanelSize = {
  width: number;
  height: number;
};

type TaskPanelOffset = {
  x: number;
  y: number;
};

type TaskPanelViewport = {
  width: number;
  height: number;
};

type TaskPanelStorage = Pick<Storage, 'getItem' | 'setItem'>;

type ResizableModalContentProps = Omit<
  React.ComponentProps<typeof Modal.Content>,
  'classNames' | 'style' | 'styles'
> & {
  style?: React.CSSProperties;
};

const ResizableModalContent = forwardRef<HTMLDivElement, ResizableModalContentProps>(
  function ResizableModalContent({ className, style, ...props }, ref) {
    return (
      <Modal.Content
        {...props}
        ref={ref}
        classNames={{ content: className }}
        styles={{ content: style }}
      />
    );
  },
);

function buildCurrentHref(pathname: string, currentSearch: string) {
  return currentSearch ? `${pathname}?${currentSearch}` : pathname;
}

function buildFullscreenHref(pathname: string, currentSearch: string, fullscreen: boolean) {
  const nextSearchParams = new URLSearchParams(currentSearch);

  if (fullscreen) {
    nextSearchParams.set('fullscreen', '1');
  } else {
    nextSearchParams.delete('fullscreen');
  }

  const nextSearch = nextSearchParams.toString();

  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

type TaskPanelModalProps = {
  opened: boolean;
  title: string;
  titleContent?: React.ReactNode;
  closeHref: string;
  closeOnEscape?: boolean;
  headerCenterContent?: React.ReactNode;
  onClose?: () => void;
  headerActions?: React.ReactNode;
  fullscreenStorageKey?: string;
  resizableStorageKey?: string;
  size?: string;
  children: React.ReactNode;
};

export function resolveTaskPanelFullscreenState({
  isMobile,
  optimisticDesktopFullScreen,
  storedDesktopFullScreen,
  urlDesktopFullScreen,
}: {
  isMobile: boolean;
  optimisticDesktopFullScreen: boolean | null;
  storedDesktopFullScreen: boolean | null;
  urlDesktopFullScreen: boolean;
}) {
  const isDesktopFullScreen =
    !isMobile &&
    (optimisticDesktopFullScreen ??
      (urlDesktopFullScreen ? true : (storedDesktopFullScreen ?? false)));

  return {
    isDesktopFullScreen,
    modalFullScreen: isMobile || isDesktopFullScreen,
  };
}

function getTaskPanelViewport(): TaskPanelViewport {
  if (typeof window === 'undefined') {
    return TASK_PANEL_RESIZE_FALLBACK_VIEWPORT;
  }

  const workspaceMain = document.querySelector(TASK_PANEL_RESIZE_BOUNDARY_SELECTOR);
  const workspaceMainRect = workspaceMain?.getBoundingClientRect();
  const width =
    workspaceMainRect && workspaceMainRect.width > 0
      ? Math.min(window.innerWidth, workspaceMainRect.width)
      : window.innerWidth;
  const height =
    workspaceMainRect && workspaceMainRect.height > 0
      ? Math.min(window.innerHeight, workspaceMainRect.height)
      : window.innerHeight;

  return { width, height };
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function clampTaskPanelSize(
  size: TaskPanelSize,
  viewport: TaskPanelViewport,
): TaskPanelSize {
  const maxWidth = Math.max(
    TASK_PANEL_RESIZE_MIN_WIDTH,
    viewport.width - TASK_PANEL_RESIZE_VIEWPORT_GUTTER,
  );
  const maxHeight = Math.max(
    TASK_PANEL_RESIZE_MIN_HEIGHT,
    viewport.height - TASK_PANEL_RESIZE_VIEWPORT_GUTTER,
  );

  return {
    width: Math.min(Math.max(size.width, TASK_PANEL_RESIZE_MIN_WIDTH), maxWidth),
    height: Math.min(Math.max(size.height, TASK_PANEL_RESIZE_MIN_HEIGHT), maxHeight),
  };
}

export function clampTaskPanelResizeOffset(
  offset: TaskPanelOffset,
  size: TaskPanelSize,
  viewport: TaskPanelViewport,
): TaskPanelOffset {
  const maxOffsetX = Math.max(
    0,
    (viewport.width - size.width - TASK_PANEL_RESIZE_VIEWPORT_GUTTER) / 2,
  );
  const maxOffsetY = Math.max(
    0,
    (viewport.height - size.height - TASK_PANEL_RESIZE_VIEWPORT_GUTTER) / 2,
  );

  return {
    x: Math.min(Math.max(offset.x, -maxOffsetX), maxOffsetX),
    y: Math.min(Math.max(offset.y, -maxOffsetY), maxOffsetY),
  };
}

export function calculateTaskPanelResizeOffset(
  baseOffset: TaskPanelOffset,
  direction: ResizeDirection,
  delta: NumberSize,
): TaskPanelOffset {
  const normalizedDirection = direction.toLowerCase();
  const x = normalizedDirection.includes('left')
    ? baseOffset.x - delta.width / 2
    : normalizedDirection.includes('right')
      ? baseOffset.x + delta.width / 2
      : baseOffset.x;
  const y = normalizedDirection.includes('top')
    ? baseOffset.y - delta.height / 2
    : normalizedDirection.includes('bottom')
      ? baseOffset.y + delta.height / 2
      : baseOffset.y;

  return { x, y };
}

export function readTaskPanelStoredSize(
  storageKey: string,
  storage: Pick<TaskPanelStorage, 'getItem'>,
  viewport: TaskPanelViewport,
): TaskPanelSize | null {
  try {
    const raw = storage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown };

    if (!isFinitePositiveNumber(parsed.width) || !isFinitePositiveNumber(parsed.height)) {
      return null;
    }

    return clampTaskPanelSize({ width: parsed.width, height: parsed.height }, viewport);
  } catch {
    return null;
  }
}

function writeTaskPanelStoredSize(
  storageKey: string,
  storage: Pick<TaskPanelStorage, 'setItem'>,
  size: TaskPanelSize,
) {
  try {
    storage.setItem(storageKey, JSON.stringify(size));
  } catch {
    // Storage can be unavailable in private or constrained browser contexts.
  }
}

function readTaskPanelStoredFullscreen(
  storageKey: string,
  storage: Pick<TaskPanelStorage, 'getItem'>,
): boolean | null {
  try {
    const raw = storage.getItem(storageKey);

    if (raw === 'true') {
      return true;
    }

    if (raw === 'false') {
      return false;
    }

    return null;
  } catch {
    return null;
  }
}

function writeTaskPanelStoredFullscreen(
  storageKey: string,
  storage: Pick<TaskPanelStorage, 'setItem'>,
  fullscreen: boolean,
) {
  try {
    storage.setItem(storageKey, String(fullscreen));
  } catch {
    // Storage can be unavailable in private or constrained browser contexts.
  }
}

function isTaskPanelHeaderInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"]',
    ),
  );
}

export function TaskPanelModal({
  opened,
  title,
  titleContent,
  closeHref,
  closeOnEscape = true,
  headerCenterContent,
  onClose,
  headerActions,
  fullscreenStorageKey,
  resizableStorageKey,
  size,
  children,
}: TaskPanelModalProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [isClosing, setIsClosing] = useState(false);
  const [optimisticDesktopFullScreen, setOptimisticDesktopFullScreen] = useState<{
    fromHref: string;
    value: boolean;
  } | null>(null);
  const [storedDesktopFullScreenOverride, setStoredDesktopFullScreenOverride] = useState<
    boolean | null
  >(null);
  const isMountedRef = useRef(true);
  const pendingCloseActionRef = useRef<(() => void) | null>(null);
  const currentSearch = searchParams.toString();
  const currentHref = buildCurrentHref(pathname, currentSearch);
  const activeOptimisticDesktopFullScreen =
    optimisticDesktopFullScreen?.fromHref === currentHref
      ? optimisticDesktopFullScreen.value
      : null;
  const urlDesktopFullScreen = searchParams.get('fullscreen') === '1';
  const storedDesktopFullScreen =
    isMobile || !fullscreenStorageKey || typeof window === 'undefined'
      ? null
      : (storedDesktopFullScreenOverride ??
        readTaskPanelStoredFullscreen(fullscreenStorageKey, window.localStorage));
  const { isDesktopFullScreen, modalFullScreen } = resolveTaskPanelFullscreenState({
    isMobile: Boolean(isMobile),
    optimisticDesktopFullScreen: activeOptimisticDesktopFullScreen,
    storedDesktopFullScreen,
    urlDesktopFullScreen,
  });
  const fullScreenLabel = isDesktopFullScreen
    ? `Exit full screen for ${title} dialog`
    : `Enter full screen for ${title} dialog`;
  const completeClose = onClose ?? (() => router.replace(closeHref));
  const isResizeEnabled = Boolean(resizableStorageKey) && isMobile === false && !modalFullScreen;
  const [viewport, setViewport] = useState<TaskPanelViewport>(TASK_PANEL_RESIZE_FALLBACK_VIEWPORT);
  const resizeBounds = {
    minWidth: TASK_PANEL_RESIZE_MIN_WIDTH,
    minHeight: TASK_PANEL_RESIZE_MIN_HEIGHT,
    maxWidth: Math.max(
      TASK_PANEL_RESIZE_MIN_WIDTH,
      viewport.width - TASK_PANEL_RESIZE_VIEWPORT_GUTTER,
    ),
    maxHeight: Math.max(
      TASK_PANEL_RESIZE_MIN_HEIGHT,
      viewport.height - TASK_PANEL_RESIZE_VIEWPORT_GUTTER,
    ),
  };
  const [resizableSize, setResizableSize] = useState<TaskPanelSize>(() =>
    clampTaskPanelSize(TASK_PANEL_RESIZE_DEFAULT_SIZE, TASK_PANEL_RESIZE_FALLBACK_VIEWPORT),
  );
  const [resizeOffset, setResizeOffset] = useState<TaskPanelOffset>({ x: 0, y: 0 });
  const resizeStartOffsetRef = useRef<TaskPanelOffset>({ x: 0, y: 0 });
  const clampedResizableSize = clampTaskPanelSize(resizableSize, viewport);
  const clampedResizeOffset = clampTaskPanelResizeOffset(
    resizeOffset,
    clampedResizableSize,
    viewport,
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isResizeEnabled || typeof window === 'undefined') {
      return;
    }

    const updateViewport = () => setViewport(getTaskPanelViewport());

    updateViewport();
    const workspaceMain = document.querySelector(TASK_PANEL_RESIZE_BOUNDARY_SELECTOR);
    const resizeObserver =
      workspaceMain && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateViewport)
        : null;

    if (workspaceMain) {
      resizeObserver?.observe(workspaceMain);
    }

    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      resizeObserver?.disconnect();
    };
  }, [isResizeEnabled]);

  useEffect(() => {
    if (!isResizeEnabled) {
      let isActive = true;

      resizeStartOffsetRef.current = { x: 0, y: 0 };
      queueMicrotask(() => {
        if (isActive) {
          setResizeOffset({ x: 0, y: 0 });
        }
      });

      return () => {
        isActive = false;
      };
    }
  }, [isResizeEnabled]);

  useIsomorphicLayoutEffect(() => {
    if (!isResizeEnabled || !resizableStorageKey || typeof window === 'undefined') {
      return;
    }

    const currentViewport = getTaskPanelViewport();
    const storedSize = readTaskPanelStoredSize(
      resizableStorageKey,
      window.localStorage,
      currentViewport,
    );
    const nextSize =
      storedSize ?? clampTaskPanelSize(TASK_PANEL_RESIZE_DEFAULT_SIZE, currentViewport);

    setResizableSize(nextSize);
  }, [isResizeEnabled, resizableStorageKey]);

  function requestClose() {
    if (pendingCloseActionRef.current) {
      return;
    }

    pendingCloseActionRef.current = completeClose;
    setIsClosing(true);
  }

  function handleResizeStop(
    _event: MouseEvent | TouchEvent,
    direction: ResizeDirection,
    ref: HTMLElement,
    delta: NumberSize,
  ) {
    if (!resizableStorageKey || typeof window === 'undefined') {
      return;
    }

    const currentViewport = getTaskPanelViewport();
    const nextSize = clampTaskPanelSize(
      { width: ref.offsetWidth, height: ref.offsetHeight },
      currentViewport,
    );
    const nextOffset = clampTaskPanelResizeOffset(
      calculateTaskPanelResizeOffset(resizeStartOffsetRef.current, direction, delta),
      nextSize,
      currentViewport,
    );

    setResizeOffset(nextOffset);
    setResizableSize(nextSize);
    writeTaskPanelStoredSize(resizableStorageKey, window.localStorage, nextSize);
  }

  function setDesktopFullScreen(nextDesktopFullScreen: boolean) {
    const nextHref = buildFullscreenHref(pathname, currentSearch, nextDesktopFullScreen);

    setOptimisticDesktopFullScreen({
      fromHref: nextHref,
      value: nextDesktopFullScreen,
    });

    if (fullscreenStorageKey && typeof window !== 'undefined') {
      setStoredDesktopFullScreenOverride(nextDesktopFullScreen);
      writeTaskPanelStoredFullscreen(
        fullscreenStorageKey,
        window.localStorage,
        nextDesktopFullScreen,
      );
    }

    router.replace(nextHref);
  }

  function handleHeaderDoubleClick(event: React.MouseEvent<HTMLElement>) {
    if (isMobile || isTaskPanelHeaderInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    setDesktopFullScreen(!isDesktopFullScreen);
  }

  const titleNode = (
    <div className={classes.titleRow}>
      <div className={classes.titleText}>{titleContent ?? <span>{title}</span>}</div>
      {headerCenterContent ? (
        <div className={classes.titleCenter}>{headerCenterContent}</div>
      ) : null}
      <Group gap="xs" wrap="nowrap" className={classes.controls}>
        {headerActions}
        {!isMobile ? (
          <Tooltip label={fullScreenLabel}>
            <ActionIcon
              variant="subtle"
              c={HEADER_ACTION_COLOR}
              size={HEADER_ACTION_SIZE}
              radius="md"
              aria-label={fullScreenLabel}
              onClick={() => {
                setDesktopFullScreen(!isDesktopFullScreen);
              }}
            >
              {isDesktopFullScreen ? (
                <IconMinimize size={HEADER_ACTION_ICON_SIZE} stroke={HEADER_ACTION_STROKE} />
              ) : (
                <IconMaximize size={HEADER_ACTION_ICON_SIZE} stroke={HEADER_ACTION_STROKE} />
              )}
            </ActionIcon>
          </Tooltip>
        ) : null}
      </Group>
    </div>
  );

  const contentChildren = (
    <>
      <Modal.Header
        className={classes.header}
        data-testid="task-panel-modal-header"
        onDoubleClick={handleHeaderDoubleClick}
      >
        <Modal.Title className={classes.title}>{titleNode}</Modal.Title>
        <Modal.CloseButton
          aria-label={`Close ${title} dialog`}
          c={HEADER_ACTION_COLOR}
          icon={<IconX size={HEADER_ACTION_ICON_SIZE} stroke={HEADER_ACTION_STROKE} />}
          radius="md"
          size={HEADER_ACTION_SIZE}
        />
      </Modal.Header>
      <Modal.Body className={classes.body}>{children}</Modal.Body>
    </>
  );

  return (
    <Modal.Root
      opened={opened && !isClosing}
      onClose={requestClose}
      onExitTransitionEnd={() => {
        const action = pendingCloseActionRef.current;
        pendingCloseActionRef.current = null;
        action?.();

        queueMicrotask(() => {
          if (isMountedRef.current) {
            setIsClosing(false);
          }
        });
      }}
      size={modalFullScreen ? '100%' : (size ?? '58rem')}
      fullScreen={modalFullScreen}
      centered={!isMobile}
      transitionProps={{ transition: 'fade-up', duration: 180, timingFunction: 'ease' }}
      closeOnClickOutside
      closeOnEscape={closeOnEscape}
      classNames={{
        inner: classes.inner,
      }}
    >
      <Modal.Overlay opacity={0.55} blur={18} />
      {isResizeEnabled ? (
        <Resizable
          as={ResizableModalContent}
          className={`${classes.content} ${classes.resizableShell}`}
          data-resizable
          enable={TASK_PANEL_RESIZE_ENABLE}
          handleWrapperClass={classes.resizeHandleWrapper}
          handleClasses={TASK_PANEL_RESIZE_HANDLE_CLASSES}
          minWidth={resizeBounds.minWidth}
          minHeight={resizeBounds.minHeight}
          maxWidth={resizeBounds.maxWidth}
          maxHeight={resizeBounds.maxHeight}
          size={clampedResizableSize}
          style={{
            left: clampedResizeOffset.x,
            top: clampedResizeOffset.y,
          }}
          onResizeStart={(_event, _direction) => {
            resizeStartOffsetRef.current = clampedResizeOffset;
          }}
          onResize={(_event, direction, ref, delta) => {
            const nextSize = clampTaskPanelSize(
              { width: ref.offsetWidth, height: ref.offsetHeight },
              viewport,
            );
            const nextOffset = clampTaskPanelResizeOffset(
              calculateTaskPanelResizeOffset(resizeStartOffsetRef.current, direction, delta),
              nextSize,
              viewport,
            );

            ref.style.left = `${nextOffset.x}px`;
            ref.style.top = `${nextOffset.y}px`;
          }}
          onResizeStop={handleResizeStop}
        >
          {contentChildren}
        </Resizable>
      ) : (
        <Modal.Content classNames={{ content: classes.content }}>{contentChildren}</Modal.Content>
      )}
    </Modal.Root>
  );
}
