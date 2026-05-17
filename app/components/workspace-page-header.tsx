import { Text, Title } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

import classes from './workspace-page-header.module.css';

type WorkspacePageHeaderProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  icon?: TablerIcon;
};

export function WorkspacePageHeader({ title, description, icon: Icon }: WorkspacePageHeaderProps) {
  return (
    <header className={classes.header} data-workspace-page-header="true">
      <div className={classes.copy}>
        <div className={classes.titleRow}>
          {Icon ? <Icon size={24} className={classes.titleIcon} aria-hidden="true" /> : null}
          <Title component="h1" order={2} className={classes.title}>
            {title}
          </Title>
        </div>
        <Text className={classes.description} size="sm">
          {description}
        </Text>
      </div>
    </header>
  );
}
