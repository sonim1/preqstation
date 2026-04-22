'use client';

import { ActionIcon, Group, Modal, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMaximize, IconMinimize, IconX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import classes from './task-panel-modal.module.css';

const HEADER_ACTION_COLOR = 'var(--ui-text)';
const HEADER_ACTION_ICON_SIZE = 16;
const HEADER_ACTION_SIZE = 28;
const HEADER_ACTION_STROKE = 1.8;

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

export function TaskPanelModal({
  opened,
  title,
  titleContent,
  closeHref,
  closeOnEscape = true,
  headerCenterContent,
  onClose,
  headerActions,
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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function requestClose() {
    if (pendingCloseActionRef.current) {
      return;
    }

    pendingCloseActionRef.current = completeClose;
    setIsClosing(true);
  }

  return (
    <Modal
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
      title={
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
      }
      size={modalFullScreen ? '100%' : (size ?? '58rem')}
      fullScreen={modalFullScreen}
      centered={!isMobile}
      closeButtonProps={{
        'aria-label': `Close ${title} dialog`,
        c: HEADER_ACTION_COLOR,
        icon: <IconX size={HEADER_ACTION_ICON_SIZE} stroke={HEADER_ACTION_STROKE} />,
        radius: 'md',
        size: HEADER_ACTION_SIZE,
      }}
      overlayProps={{ opacity: 0.55, blur: 18 }}
      transitionProps={{ transition: 'fade-up', duration: 180, timingFunction: 'ease' }}
      closeOnClickOutside
      closeOnEscape={closeOnEscape}
      classNames={{
        inner: classes.inner,
        content: classes.content,
        header: classes.header,
        title: classes.title,
        body: classes.body,
      }}
    >
      {children}
    </Modal>
  );
}
