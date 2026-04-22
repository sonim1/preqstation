'use client';

import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

type ColorSchemeToggleProps = {
  tabIndex?: number;
};

export function ColorSchemeToggle({ tabIndex }: ColorSchemeToggleProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration guard pattern
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <ActionIcon
        size="lg"
        variant="default"
        aria-label="Toggle color scheme"
        disabled
        tabIndex={tabIndex}
      >
        <IconMoon size={18} />
      </ActionIcon>
    );
  }

  return (
    <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <ActionIcon
        size="lg"
        variant="default"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        tabIndex={tabIndex}
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
