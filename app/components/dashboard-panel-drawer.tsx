'use client';

import { ActionIcon, Drawer, Group, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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

type DashboardPanelDrawerProps = {
  opened: boolean;
  title: string;
  closeHref: string;
  headerActions?: React.ReactNode;
  size?: string;
  children: React.ReactNode;
};

export function DashboardPanelDrawer({
  opened,
  title,
  closeHref,
  headerActions,
  size,
  children,
}: DashboardPanelDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const isDesktopFullScreen = !isMobile && searchParams.get('fullscreen') === '1';
  const nextFullScreenHref = buildFullscreenHref(
    pathname,
    searchParams.toString(),
    !isDesktopFullScreen,
  );
  const fullScreenLabel = isDesktopFullScreen
    ? `Exit full screen for ${title} panel`
    : `Enter full screen for ${title} panel`;

  return (
    <Drawer
      opened={opened}
      onClose={() => router.replace(closeHref)}
      closeButtonProps={{ 'aria-label': `Close ${title} panel` }}
      title={
        <Group gap="sm" wrap="nowrap" style={{ width: '100%' }}>
          <span style={{ minWidth: 0, flex: '1 1 auto' }}>{title}</span>
          <Group gap="xs" wrap="nowrap" style={{ marginLeft: 'auto' }}>
            {headerActions}
            {!isMobile ? (
              <Tooltip label={fullScreenLabel}>
                <ActionIcon
                  variant="subtle"
                  aria-label={fullScreenLabel}
                  onClick={() => router.replace(nextFullScreenHref)}
                >
                  {isDesktopFullScreen ? (
                    <IconArrowsMinimize size={16} />
                  ) : (
                    <IconArrowsMaximize size={16} />
                  )}
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
        </Group>
      }
      position="right"
      size={isMobile || isDesktopFullScreen ? '100%' : (size ?? 'xl')}
      padding="lg"
      overlayProps={{ opacity: 0.45, blur: 2 }}
      closeOnClickOutside
      closeOnEscape
    >
      {children}
    </Drawer>
  );
}
