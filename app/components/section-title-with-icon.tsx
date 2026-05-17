import { Group, type GroupProps, Title, type TitleProps } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

import classes from './section-title-with-icon.module.css';

type SectionTitleWithIconProps = {
  children: React.ReactNode;
  icon: TablerIcon;
  iconSize?: number;
  order?: TitleProps['order'];
  mb?: GroupProps['mb'];
};

export function SectionTitleWithIcon({
  children,
  icon: Icon,
  iconSize = 20,
  order = 4,
  mb,
}: SectionTitleWithIconProps) {
  return (
    <Group
      gap="sm"
      align="center"
      wrap="nowrap"
      className={classes.root}
      mb={mb}
      data-section-title-with-icon="true"
    >
      <Icon size={iconSize} className={classes.icon} aria-hidden="true" />
      <Title order={order}>{children}</Title>
    </Group>
  );
}
