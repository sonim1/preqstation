'use client';
import { ActionIcon, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDots } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';

type ProjectCardMenuProps = {
  canPause?: boolean;
  editHref: string;
  pauseFormId?: string | null;
  projectId: string;
  projectName: string;
};

export function ProjectCardMenu({
  canPause = false,
  editHref,
  pauseFormId = null,
  projectId,
  projectName,
}: ProjectCardMenuProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handlePauseProject = useCallback(() => {
    if (!pauseFormId) return;
    const form = document.getElementById(pauseFormId) as HTMLFormElement | null;
    form?.requestSubmit();
  }, [pauseFormId]);

  const handleConfirmDelete = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const form = document.getElementById(`delete-project-${projectId}`) as HTMLFormElement | null;
    form?.requestSubmit();
  }, [projectId]);

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            size={44}
            className="project-card-menu"
            aria-label="Project actions"
            style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
          >
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {canPause && pauseFormId ? (
            <Menu.Item onClick={handlePauseProject}>Pause project</Menu.Item>
          ) : null}
          <Menu.Item component={Link} href={editHref}>
            Edit
          </Menu.Item>
          <Menu.Item color="red" onClick={open}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={opened} onClose={close} title="Delete project" centered size="sm">
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <strong>{projectName}</strong>? All tasks and work logs
            in this project will be permanently deleted. This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmDelete} loading={busy}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
