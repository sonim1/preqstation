import { ActionIcon, Group, Paper, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useId } from 'react';

import type { Terminology } from '@/lib/terminology';

import classes from './dashboard-brief-radar-hero.module.css';

type DashboardBriefRadarHeroProps = {
  dateLabel: string;
  actions: React.ReactNode;
  terminology: Terminology;
  weeklyWorkLogCount: number;
  projectsCount: number;
  repoConnected: number;
  vercelConnected: number;
  todayFocusCount: number;
  focusQueueCount: number;
  holdCount: number;
  readyCount: number;
  aiActiveCount: number;
};

const visuallyHiddenStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function getInfoHintDescriptionId(label: string) {
  return `${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-help-description`;
}

function InfoHint({
  label,
  tooltip,
  tone,
}: {
  label: string;
  tooltip: string;
  tone: 'light' | 'dark';
}) {
  const descriptionId = `${getInfoHintDescriptionId(label)}-${useId().replace(/:/g, '')}`;

  return (
    <Tooltip
      label={tooltip}
      withArrow
      multiline
      w={220}
      events={{ hover: true, focus: true, touch: false }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        radius="xl"
        aria-label={`${label} help`}
        aria-describedby={descriptionId}
        className={`${classes.infoHint} ${tone === 'dark' ? classes.infoHintDark : classes.infoHintLight}`}
      >
        <IconInfoCircle size={16} stroke={1.8} />
        <span id={descriptionId} style={visuallyHiddenStyle}>
          {tooltip}
        </span>
      </ActionIcon>
    </Tooltip>
  );
}

function MetricCard({
  value,
  label,
  tooltip,
}: {
  value: string | number;
  label: string;
  tooltip: string;
}) {
  return (
    <Paper withBorder className={classes.metricCard} radius="md" p={{ base: 'sm', sm: 'md' }}>
      <Text
        className={classes.metricValue}
        fw={800}
        fz={{ base: '1.6rem', sm: '2rem' }}
        style={{ letterSpacing: '-0.05em', lineHeight: 1 }}
      >
        {value}
      </Text>
      <Group gap={6} mt={8} wrap="nowrap" align="center">
        <Text className={classes.metricLabel} fw={700} size="sm">
          {label}
        </Text>
        <InfoHint label={label} tooltip={tooltip} tone="light" />
      </Group>
    </Paper>
  );
}

function SignalCard({
  value,
  label,
  tooltip,
}: {
  value: string | number;
  label: string;
  tooltip: string;
}) {
  return (
    <Paper withBorder radius="md" p={{ base: 'sm', sm: 'md' }} className={classes.signalCard}>
      <Text
        className={classes.signalValue}
        fw={800}
        fz={{ base: '1.6rem', sm: '2rem' }}
        style={{ letterSpacing: '-0.05em', lineHeight: 1 }}
      >
        {value}
      </Text>
      <Group gap={6} mt={8} wrap="nowrap" align="center">
        <Text className={classes.signalLabel} size="sm">
          {label}
        </Text>
        <InfoHint label={label} tooltip={tooltip} tone="dark" />
      </Group>
    </Paper>
  );
}

export function DashboardBriefRadarHero({
  dateLabel,
  actions,
  terminology,
  weeklyWorkLogCount,
  projectsCount,
  repoConnected,
  vercelConnected,
  todayFocusCount,
  focusQueueCount,
  holdCount,
  readyCount,
  aiActiveCount,
}: DashboardBriefRadarHeroProps) {
  const holdTaskLabel =
    holdCount === 1 ? terminology.task.singularLower : terminology.task.pluralLower;
  const currentException =
    holdCount > 0
      ? `${holdCount} ${holdTaskLabel} on hold`
      : `No ${terminology.task.pluralLower} on hold`;
  const weeklyContext =
    'Last 7 days of output and how many visible projects already have repo or deploy coverage.';
  const rightNowContext =
    'Focus is selected for today, queue is the remaining inbox or todo load, plus ready handoffs and active agents.';

  return (
    <Stack gap="md">
      <Paper withBorder className={classes.heroPanel} radius="lg" p={{ base: 'md', sm: 'lg' }}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Stack gap={6} style={{ flex: 1, minWidth: 280 }}>
            <Text
              className={classes.heroMeta}
              size="xs"
              fw={700}
              tt="uppercase"
              style={{ letterSpacing: '0.08em' }}
            >
              Brief + Radar
            </Text>
            <Title
              className={classes.heroTitle}
              order={2}
              size="h1"
              style={{ letterSpacing: '-0.03em', lineHeight: 0.92 }}
            >
              Weekly brief, live radar.
            </Title>
            <Text className={classes.heroSummary} size="sm">
              Start with the weekly story, then scan the live signals that need motion.
            </Text>
            <Group gap="sm" wrap="wrap" align="center">
              <Text className={classes.heroMeta} size="sm">
                {dateLabel}
              </Text>
            </Group>
          </Stack>
          <Stack gap="sm" align="flex-end" style={{ minWidth: 220 }}>
            <Group gap="xs" wrap="wrap" justify="flex-end">
              {actions}
            </Group>
            <Paper
              withBorder
              className={classes.exceptionCard}
              radius="md"
              p="sm"
              style={{
                width: '100%',
                maxWidth: 280,
              }}
            >
              <Text
                className={classes.exceptionLabel}
                size="10px"
                fw={800}
                tt="uppercase"
                style={{ letterSpacing: '0.1em' }}
              >
                Current Exception
              </Text>
              <Text className={classes.exceptionText} size="sm" fw={700} mt={8}>
                {currentException}
              </Text>
            </Paper>
          </Stack>
        </Group>
      </Paper>

      <Paper withBorder className={classes.weekPanel} radius="lg" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <div>
            <Text
              className={classes.weekLabel}
              size="10px"
              fw={800}
              tt="uppercase"
              style={{ letterSpacing: '0.1em' }}
            >
              This Week
            </Text>
            <Text className={classes.sectionContext} size="sm" mt={6}>
              {weeklyContext}
            </Text>
          </div>

          <SimpleGrid
            cols={{ base: 2, sm: 2, lg: 4 }}
            spacing="sm"
            data-dashboard-brief-grid="2-up"
          >
            <MetricCard
              value={weeklyWorkLogCount}
              label="Work Logs"
              tooltip="Counts work logs from the last 7 days."
            />
            <MetricCard
              value={`${repoConnected}/${projectsCount || 0}`}
              label="Repos"
              tooltip="Shows projects with a connected repo out of all visible projects."
            />
            <MetricCard
              value={vercelConnected}
              label="Deploys"
              tooltip="Counts projects with a connected deploy target."
            />
            <MetricCard
              value={todayFocusCount}
              label="Today Focus"
              tooltip="Counts tasks added to the focus list for today."
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} className={classes.radarPanel}>
        <Stack gap="md">
          <div>
            <Text
              className={classes.radarLabel}
              size="10px"
              fw={800}
              tt="uppercase"
              style={{ letterSpacing: '0.1em' }}
            >
              Right Now
            </Text>
            <Text className={classes.sectionContext} size="sm" mt={6}>
              {rightNowContext}
            </Text>
          </div>

          <SimpleGrid
            cols={{ base: 2, sm: 2, lg: 4 }}
            spacing="sm"
            data-dashboard-radar-grid="2-up"
          >
            <SignalCard
              value={todayFocusCount}
              label="In Focus"
              tooltip="Counts tasks added to the focus list for today."
            />
            <SignalCard
              value={focusQueueCount}
              label="Queue"
              tooltip="Counts inbox or todo tasks that are not already in the focus list for today."
            />
            <SignalCard
              value={readyCount}
              label={terminology.statuses.ready}
              tooltip={`Counts ${terminology.task.pluralLower} currently in ${terminology.statuses.ready}.`}
            />
            <SignalCard
              value={aiActiveCount}
              label={terminology.agents.plural}
              tooltip={`Counts ${terminology.task.pluralLower} with active ${terminology.agents.pluralLower}.`}
            />
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  );
}
