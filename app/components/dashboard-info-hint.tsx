import { ActionIcon, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

type DashboardInfoHintProps = {
  label: string;
  tooltip: string;
};

export function DashboardInfoHint({ label, tooltip }: DashboardInfoHintProps) {
  return (
    <Tooltip
      label={tooltip}
      withArrow
      multiline
      w={220}
      events={{ hover: true, focus: true, touch: true }}
    >
      <ActionIcon
        variant="subtle"
        size={44}
        radius="xl"
        aria-label={`${label} help`}
        styles={{ root: { color: 'var(--ui-muted-text)' } }}
      >
        <IconInfoCircle size={16} stroke={1.8} />
      </ActionIcon>
    </Tooltip>
  );
}
