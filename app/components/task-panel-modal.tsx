'use client';

import { ActionIcon, Group, Modal, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMaximize, IconMinimize, IconX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type Enable, type HandleClassName, Resizable } from 're-resizable';
import { useEffect, useRef, useState } from 'react';

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

type TaskPanelSize = {
  width: number;
  height: number;
};

type TaskPanelViewport = {
  width: number;
  height: number;
};

type TaskPanelStorage = Pick<Storage, 'getItem' | 'setItem'>;

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
  resizableStorageKey?: string;
  size?: string;
  children: React.ReactNode;
};

export function resolveTaskPanelFullscreenState({
  isMobile,
  optimisticDesktopFullScreen,
  urlDesktopFullScreen,
}: {
  isMobile: boolean;
  optimisticDesktopFullScreen: boolean | null;
  urlDesktopFullScreen: boolean;
}) {
  const isDesktopFullScreen = !isMobile && (optimisticDesktopFullScreen ?? urlDesktopFullScreen);

  return {
    isDesktopFullScreen,
    modalFullScreen: isMobile || isDesktopFullScreen,
  };
}

function getTaskPanelViewport(): TaskPanelViewport {
  if (typeof window === 'undefined') {
    return TASK_PANEL_RESIZE_FALLBACK_VIEWPORT;
  }

  return { width: window.innerWidth, height: window.innerHeight };
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

export function TaskPanelModal({
  opened,
  title,
  titleContent,
  closeHref,
  closeOnEscape = true,
  headerCenterContent,
  onClose,
  headerActions,
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
  const isMountedRef = useRef(true);
  const pendingCloseActionRef = useRef<(() => void) | null>(null);
  const currentSearch = searchParams.toString();
  const currentHref = buildCurrentHref(pathname, currentSearch);
  const activeOptimisticDesktopFullScreen =
    optimisticDesktopFullScreen?.fromHref === currentHref
      ? optimisticDesktopFullScreen.value
      : null;
  const urlDesktopFullScreen = !isMobile && searchParams.get('fullscreen') === '1';
  const { isDesktopFullScreen, modalFullScreen } = resolveTaskPanelFullscreenState({
    isMobile: Boolean(isMobile),
    optimisticDesktopFullScreen: activeOptimisticDesktopFullScreen,
    urlDesktopFullScreen,
  });
  const nextFullScreenHref = buildFullscreenHref(pathname, currentSearch, !isDesktopFullScreen);
  const fullScreenLabel = isDesktopFullScreen
    ? `Exit full screen for ${title} dialog`
    : `Enter full screen for ${title} dialog`;
  const completeClose = onClose ?? (() => router.replace(closeHref));
  const isResizeEnabled = Boolean(resizableStorageKey) && !isMobile && !modalFullScreen;
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
  const clampedResizableSize = clampTaskPanelSize(resizableSize, viewport);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isResizeEnabled || typeof window === 'undefined') {
      return;
    }

    const updateViewport = () => setViewport(getTaskPanelViewport());

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, [isResizeEnabled]);

  useEffect(() => {
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
    let isActive = true;

    queueMicrotask(() => {
      if (isActive) {
        setResizableSize(nextSize);
      }
    });

    return () => {
      isActive = false;
    };
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
    _direction: unknown,
    ref: HTMLElement,
  ) {
    if (!resizableStorageKey || typeof window === 'undefined') {
      return;
    }

    const nextSize = clampTaskPanelSize(
      { width: ref.offsetWidth, height: ref.offsetHeight },
      getTaskPanelViewport(),
    );

    setResizableSize(nextSize);
    writeTaskPanelStoredSize(resizableStorageKey, window.localStorage, nextSize);
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
                setOptimisticDesktopFullScreen({
                  fromHref: currentHref,
                  value: !isDesktopFullScreen,
                });
                router.replace(nextFullScreenHref);
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

  const content = (
    <Modal.Content className={classes.content} data-resizable={isResizeEnabled || undefined}>
      <Modal.Header className={classes.header}>
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
    </Modal.Content>
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
          className={classes.resizableShell}
          enable={TASK_PANEL_RESIZE_ENABLE}
          handleClasses={TASK_PANEL_RESIZE_HANDLE_CLASSES}
          minWidth={resizeBounds.minWidth}
          minHeight={resizeBounds.minHeight}
          maxWidth={resizeBounds.maxWidth}
          maxHeight={resizeBounds.maxHeight}
          size={clampedResizableSize}
          onResizeStop={handleResizeStop}
        >
          {content}
        </Resizable>
      ) : (
        content
      )}
    </Modal.Root>
  );
}
