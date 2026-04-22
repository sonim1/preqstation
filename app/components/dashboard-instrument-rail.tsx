'use client';

import { Group, Paper, Progress, Stack, Text, Title } from '@mantine/core';
import { IconPlugConnected } from '@tabler/icons-react';
import { useState } from 'react';

import type { Terminology } from '@/lib/terminology';

import { DashboardInfoHint } from './dashboard-info-hint';
import classes from './dashboard-operator-desk.module.css';
import { LoadMoreButton } from './load-more-button';
import panelStyles from './panels.module.css';

type ReadyTodo = {
  id: string;
  taskKey: string;
  title: string;
  project: { name: string } | null;
};

export const INITIAL_VISIBLE_READY_TODOS = 5;

export function getVisibleReadyTodos(readyTodos: ReadyTodo[], visibleCount: number) {
  return readyTodos.slice(0, visibleCount);
}

export function getNextVisibleReadyCount(visibleCount: number, totalReadyTodos: number) {
  return Math.min(visibleCount + INITIAL_VISIBLE_READY_TODOS, totalReadyTodos);
}

export function hasMoreReadyTodos(totalReadyTodos: number, visibleCount: number) {
  return totalReadyTodos > visibleCount;
}

type DashboardInstrumentRailProps = {
  readyTodos: ReadyTodo[];
  terminology: Terminology;
  projectsCount: number;
  repoConnected: number;
  vercelConnected: number;
  embedded?: boolean;
};

export function DashboardInstrumentRail({
  readyTodos,
  terminology,
  projectsCount,
  repoConnected,
  vercelConnected,
  embedded = false,
}: DashboardInstrumentRailProps) {
  const [visibleReadyCount, setVisibleReadyCount] = useState(INITIAL_VISIBLE_READY_TODOS);
  const rootClassName = [
    embedded ? classes.panelEmbeddedRail : panelStyles.sectionPanel,
    classes.rail,
  ]
    .filter(Boolean)
    .join(' ');
  const visibleReadyTodos = getVisibleReadyTodos(readyTodos, visibleReadyCount);
  const hasHiddenReadyTodos = hasMoreReadyTodos(readyTodos.length, visibleReadyCount);

  function loadMoreReadyTodos() {
    setVisibleReadyCount((count) => getNextVisibleReadyCount(count, readyTodos.length));
  }

  return (
    <Paper
      withBorder
      radius="lg"
      p={{ base: 'md', sm: 'lg' }}
      className={rootClassName}
      data-dashboard-rail="true"
      style={
        embedded ? { borderWidth: 0, background: 'transparent', boxShadow: 'none' } : undefined
      }
    >
      <Stack gap="lg">
        <div className={classes.railModule} data-dashboard-module="at-the-pass">
          <Group
            justify="space-between"
            align="flex-start"
            className={classes.railHeader}
            data-dashboard-header="at-the-pass"
          >
            <Group gap={6} align="center" wrap="nowrap">
              <Title order={3}>At the Pass</Title>
              <DashboardInfoHint
                label="At the Pass"
                tooltip="Ready work, release handoffs, and inspection."
              />
            </Group>
            <Text
              size="xs"
              className={`${classes.sectionMeta} ${classes.sectionMetaCurrent}`}
              data-rail-summary="ready"
            >
              {readyTodos.length} ready
            </Text>
          </Group>

          <div className={classes.passList} data-pass-list="true">
            {readyTodos.length === 0 ? (
              <Text size="sm" className={classes.passEmpty}>
                {`No ${terminology.task.pluralLower} waiting at the pass.`}
              </Text>
            ) : (
              visibleReadyTodos.map((todo) => (
                <div key={todo.id} className={classes.passRow} data-pass-row={todo.taskKey}>
                  <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                    <div className={classes.passRowBody}>
                      <Text className={classes.passTokenKey} size="xs" fw={700} tt="uppercase">
                        {todo.taskKey}
                      </Text>
                      <Text className={classes.passTokenTitle} fw={600} mt={4}>
                        {todo.title}
                      </Text>
                    </div>
                    <Text size="sm" className={classes.passTokenMeta}>
                      {todo.project ? todo.project.name : 'General'}
                    </Text>
                  </Group>
                </div>
              ))
            )}
          </div>
          {hasHiddenReadyTodos ? (
            <div className={classes.passLoadMore} data-pass-load-more="true">
              <LoadMoreButton
                onClick={loadMoreReadyTodos}
                disabled={false}
                loading={false}
                style={{ minHeight: 'var(--ui-hit-touch-min)' }}
              />
            </div>
          ) : null}
        </div>

        <div className={classes.railModule} data-dashboard-module="mise-en-place">
          <Group justify="space-between" align="center" mb="sm">
            <Group gap={6} align="center">
              <Title order={4}>Mise en Place</Title>
              <DashboardInfoHint
                label="Mise en Place"
                tooltip="Connected project coverage across repository and deploy surfaces."
              />
            </Group>
            <IconPlugConnected size={16} color="var(--ui-muted-text)" />
          </Group>

          <div className={classes.miniMetricBar}>
            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.miniMetricLabel}>
                Repo linked
              </Text>
              <Text size="sm" fw={600}>
                {repoConnected}/{projectsCount}
              </Text>
            </Group>
            <Progress
              value={projectsCount ? (repoConnected / projectsCount) * 100 : 0}
              radius="xl"
              styles={{ section: { backgroundColor: 'var(--ui-accent)' } }}
            />

            <Group justify="space-between" align="center">
              <Text size="sm" className={classes.miniMetricLabel}>
                Deploy linked
              </Text>
              <Text size="sm" fw={600}>
                {vercelConnected}/{projectsCount}
              </Text>
            </Group>
            <Progress
              value={projectsCount ? (vercelConnected / projectsCount) * 100 : 0}
              radius="xl"
              styles={{
                section: {
                  backgroundColor: 'color-mix(in srgb, var(--ui-accent), var(--ui-success) 38%)',
                },
              }}
            />
          </div>
        </div>
      </Stack>
    </Paper>
  );
}
