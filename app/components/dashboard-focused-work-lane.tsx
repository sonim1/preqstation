'use client';

import { Badge, Group, Paper, Stack, Stepper, Text, Title, Tooltip } from '@mantine/core';
import {
  IconCircleCheck,
  IconEye,
  IconInbox,
  IconListCheck,
  IconPlayerPause,
} from '@tabler/icons-react';
import { type ComponentType } from 'react';

import { EmptyState } from '@/app/components/empty-state';
import { LinkButton } from '@/app/components/link-button';
import { TaskPriorityIcon } from '@/app/components/task-priority-icon';
import type { OnTheLineLaneRole } from '@/lib/dashboard-on-the-line';
import { TASK_RUN_STATE_LABELS } from '@/lib/task-meta';
import type { Terminology } from '@/lib/terminology';

import classes from './dashboard-focused-work-lane.module.css';
import { DashboardInfoHint } from './dashboard-info-hint';
import panelStyles from './panels.module.css';

type FocusTodo = {
  id: string;
  taskKey: string;
  title: string;
  taskPriority: string;
  status: string;
  focusedAt?: Date | null;
  project: { name: string } | null;
  labels: Array<{ id: string; name: string; color?: string | null }>;
  engine?: string | null;
  runState?: string | null;
  laneRole?: OnTheLineLaneRole;
};

type DashboardFocusedWorkLaneProps = {
  focusTodos: FocusTodo[];
  readyCount: number;
  selectedProjectId?: string;
  terminology: Terminology;
  toggleTodayFocusAction: (formData: FormData) => Promise<void>;
  updateTodoStatusAction: (formData: FormData) => Promise<void>;
  embedded?: boolean;
};

const WORKFLOW_STEP_IDS = ['inbox', 'planned', 'hold', 'ready', 'done'] as const;

function buildDashboardHref(options: {
  panel?: string | null;
  projectId?: string;
  taskId?: string;
}) {
  const query = new URLSearchParams();
  if (options.projectId) query.set('projectId', options.projectId);
  if (options.taskId) query.set('taskId', options.taskId);
  if (options.panel) query.set('panel', options.panel);
  const text = query.toString();
  return text ? `/dashboard?${text}` : '/dashboard';
}

function isKitchenTerminology(terminology: Terminology) {
  return terminology.statuses.ready === 'Pass' && terminology.statuses.hold === "86'd";
}

function getWorkflowSteps(terminology: Terminology) {
  const icons: Record<string, ComponentType<{ size?: number }>> = {
    inbox: IconInbox,
    todo: IconListCheck,
    hold: IconPlayerPause,
    ready: IconEye,
    done: IconCircleCheck,
  };

  return [
    {
      id: WORKFLOW_STEP_IDS[0],
      status: 'inbox',
      label: terminology.boardStatuses.inbox,
      icon: icons.inbox,
    },
    {
      id: WORKFLOW_STEP_IDS[1],
      status: 'todo',
      label: terminology.boardStatuses.todo,
      icon: icons.todo,
    },
    {
      id: WORKFLOW_STEP_IDS[2],
      status: 'hold',
      label: terminology.boardStatuses.hold,
      icon: icons.hold,
    },
    {
      id: WORKFLOW_STEP_IDS[3],
      status: 'ready',
      label: terminology.boardStatuses.ready,
      icon: icons.ready,
    },
    {
      id: WORKFLOW_STEP_IDS[4],
      status: 'done',
      label: terminology.boardStatuses.done,
      icon: icons.done,
    },
  ] as const;
}

function getStageMeta(todo: FocusTodo, terminology: Terminology) {
  const kitchen = isKitchenTerminology(terminology);
  const activeLabel = kitchen ? 'On the line' : TASK_RUN_STATE_LABELS.running;
  const readyLabel = kitchen ? 'At the pass' : terminology.statuses.ready;

  if (todo.status === 'done') {
    return { tone: 'ready' as const, label: terminology.statuses.done };
  }

  if (todo.status === 'ready') {
    return { tone: 'ready' as const, label: readyLabel };
  }

  if (todo.status === 'hold') {
    return { tone: 'attention' as const, label: terminology.statuses.hold };
  }

  if (todo.runState === 'running') {
    return { tone: 'active' as const, label: activeLabel };
  }

  if (todo.laneRole === 'now') {
    return { tone: 'active' as const, label: activeLabel };
  }

  if (todo.status === 'inbox') {
    return { tone: 'default' as const, label: terminology.boardStatuses.inbox };
  }

  return { tone: 'default' as const, label: terminology.boardStatuses.todo };
}

function getWorkflowStepIndex(status: string) {
  if (status === 'inbox') return 0;
  if (status === 'hold') return 2;
  if (status === 'ready') return 3;
  if (status === 'done') return 4;
  return 1;
}

function getStepperColor(tone: 'active' | 'attention' | 'ready' | 'default') {
  if (tone === 'attention') return 'yellow';
  if (tone === 'ready') return 'green';
  if (tone === 'default') return 'gray';
  return 'brand';
}

export function DashboardFocusedWorkLane({
  focusTodos,
  selectedProjectId,
  terminology,
  embedded = false,
}: DashboardFocusedWorkLaneProps) {
  const visibleTodos = focusTodos;
  const todayCount = visibleTodos.filter((todo) => todo.laneRole === 'now').length;
  const nextCount = Math.max(visibleTodos.length - todayCount, 0);
  const workflowSteps = getWorkflowSteps(terminology);
  const rootClassName = [embedded ? classes.panelEmbedded : panelStyles.sectionPanel, classes.panel]
    .filter(Boolean)
    .join(' ');

  return (
    <Paper
      withBorder
      radius="lg"
      p={{ base: 'md', sm: 'lg' }}
      className={rootClassName}
      data-dashboard-module="on-the-line"
      style={
        embedded ? { borderWidth: 0, background: 'transparent', boxShadow: 'none' } : undefined
      }
    >
      <Group
        justify="space-between"
        align="flex-start"
        wrap="wrap"
        className={classes.header}
        data-dashboard-header="on-the-line"
      >
        <Group gap={6} align="center" wrap="nowrap">
          <Title order={3}>On the Line</Title>
          <DashboardInfoHint label="On the Line" tooltip="The work surface." />
        </Group>
        <div className={classes.summaryCluster}>
          <Text
            size="xs"
            className={`${classes.summaryMeta} ${classes.summaryMetaCurrent}`}
            data-on-the-line-summary="now"
            data-on-the-line-summary-tone="current"
          >
            {todayCount} now
          </Text>
          <Text
            size="xs"
            className={classes.summaryMeta}
            data-on-the-line-summary="next"
            data-on-the-line-summary-tone="muted"
          >
            {nextCount} next
          </Text>
        </div>
      </Group>

      <Stack gap="sm" mt="md">
        {visibleTodos.length === 0 ? (
          <EmptyState
            title={`No ${terminology.task.pluralLower} selected for the line`}
            description={`Pick a ${terminology.task.singularLower} to make the work surface active again.`}
            action={
              <LinkButton
                href={buildDashboardHref({
                  panel: 'task',
                  projectId: selectedProjectId || undefined,
                })}
                size="xs"
              >
                {`New ${terminology.task.singular}`}
              </LinkButton>
            }
          />
        ) : null}

        {visibleTodos.map((todo) => {
          const stageMeta = getStageMeta(todo, terminology);
          const workflowIndex = getWorkflowStepIndex(todo.status);

          return (
            <article key={todo.id} className={classes.row} data-dashboard-work-row={todo.taskKey}>
              <Group justify="space-between" align="flex-start" className={classes.rowHeader}>
                <div className={classes.titleWrap}>
                  <Group gap={8} wrap="nowrap" align="center">
                    <TaskPriorityIcon priority={todo.taskPriority} size={14} />
                    <Text className={classes.taskKey} fw={700} size="xs" tt="uppercase">
                      {todo.taskKey}
                    </Text>
                  </Group>
                  <Text className={classes.taskTitle} fw={700} size="lg" mt={4}>
                    {todo.title}
                  </Text>
                  <Group gap={8} mt={8} wrap="wrap">
                    <Badge size="sm" variant="light" color={todo.project ? 'brand' : 'gray'}>
                      {todo.project ? todo.project.name : 'General'}
                    </Badge>
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        stageMeta.tone === 'attention'
                          ? 'yellow'
                          : stageMeta.tone === 'ready'
                            ? 'green'
                            : 'gray'
                      }
                      className={
                        stageMeta.tone === 'attention'
                          ? classes.statusChipAttention
                          : stageMeta.tone === 'ready'
                            ? classes.statusChipReady
                            : classes.statusChip
                      }
                    >
                      {stageMeta.label}
                    </Badge>
                    {todo.labels.length > 0 ? (
                      <Text size="sm" className={classes.taskMeta}>
                        {todo.labels.length === 1
                          ? todo.labels[0].name
                          : `${todo.labels.length} labels`}
                      </Text>
                    ) : null}
                  </Group>

                  <div className={classes.track}>
                    <Stepper
                      active={workflowIndex}
                      color={getStepperColor(stageMeta.tone)}
                      iconSize={30}
                      allowNextStepsSelect={false}
                      wrap={false}
                      data-workflow-stepper={todo.taskKey}
                      aria-label={`${todo.taskKey} workflow`}
                      styles={{
                        stepBody: {
                          display: 'none',
                        },
                        step: {
                          padding: 0,
                          flex: '0 0 auto',
                          cursor: 'default',
                        },
                        stepIcon: {
                          borderWidth: 4,
                          lineHeight: 0,
                        },
                        separator: {
                          marginLeft: -2,
                          marginRight: -2,
                          height: 10,
                        },
                      }}
                    >
                      {workflowSteps.map((step) => (
                        <Stepper.Step
                          key={step.id}
                          icon={
                            <Tooltip label={step.label} openDelay={90} withArrow position="top">
                              <span
                                className={classes.stepIconGlyph}
                                data-workflow-step-icon={step.id}
                                title={step.label}
                                aria-label={step.label}
                              >
                                <step.icon size={14} />
                              </span>
                            </Tooltip>
                          }
                          completedIcon={
                            <Tooltip label={step.label} openDelay={90} withArrow position="top">
                              <span
                                className={classes.stepIconGlyph}
                                data-workflow-step-icon={step.id}
                                title={step.label}
                                aria-label={step.label}
                              >
                                <step.icon size={14} />
                              </span>
                            </Tooltip>
                          }
                          label={step.label}
                          aria-label={step.label}
                          title={step.label}
                          data-workflow-step={step.id}
                        />
                      ))}
                    </Stepper>
                  </div>
                </div>
              </Group>
            </article>
          );
        })}
      </Stack>
    </Paper>
  );
}
