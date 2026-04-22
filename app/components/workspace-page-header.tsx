import { Text, Title } from '@mantine/core';

import classes from './workspace-page-header.module.css';

type WorkspacePageHeaderProps = {
  title: React.ReactNode;
  description: React.ReactNode;
};

export function WorkspacePageHeader({ title, description }: WorkspacePageHeaderProps) {
  return (
    <header className={classes.header} data-workspace-page-header="true">
      <div className={classes.copy}>
        <Title component="h1" order={2} className={classes.title}>
          {title}
        </Title>
        <Text className={classes.description} size="sm">
          {description}
        </Text>
      </div>
    </header>
  );
}
