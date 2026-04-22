'use client';
import { Button, Menu } from '@mantine/core';
import { IconClipboardPlus, IconDots, IconPencil } from '@tabler/icons-react';
import Link from 'next/link';

type ProjectHeroMenuProps = {
  workLogHref: string;
  editProjectHref: string;
};

export function ProjectHeroMenu({ workLogHref, editProjectHref }: ProjectHeroMenuProps) {
  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <Button variant="default" size="xs" leftSection={<IconDots size={14} />}>
          More
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href={workLogHref}
          leftSection={<IconClipboardPlus size={14} />}
        >
          New Work Log
        </Menu.Item>
        <Menu.Item component={Link} href={editProjectHref} leftSection={<IconPencil size={14} />}>
          Edit Project
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
