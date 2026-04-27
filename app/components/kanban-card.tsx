'use client';

import { ActionIcon, Image, Menu, Text, Tooltip } from '@mantine/core';
import { IconChecklist, IconCopy, IconDots, IconSend } from '@tabler/icons-react';
import Link from 'next/link';
import { memo, type ReactNode, useState } from 'react';

import { formatDateForDisplay } from '@/lib/date-time';
import { ENGINE_CONFIGS, getEngineConfig } from '@/lib/engine-icons';
import type { EnginePresets, KanbanStatus, KanbanTask } from '@/lib/kanban-helpers';
import { boardStatusLabel, resolveDisplayEngine } from '@/lib/kanban-helpers';
import { showErrorNotification, showSuccessNotification } from '@/lib/notifications';
import { resolveTaskDispatchVerb } from '@/lib/openclaw-command';
import { parseTaskPriority, resolveTaskLabelSwatchColor, type TaskRunState } from '@/lib/task-meta';
import { buildTaskTelegramMessage, sendTaskTelegramMessage } from '@/lib/task-telegram-client';
import { parseChecklistCounts } from '@/lib/utils/task-utils';

import styles from './cards.module.css';
import { KanbanCardLabelShortcut } from './kanban-card-label-shortcut';
import { KanbanStatusIndicator } from './kanban-status-indicator';
import { TaskPriorityIcon } from './task-priority-icon';
import { useTerminology } from './terminology-provider';
import { useTimeZone } from './timezone-provider';

const RUN_STATE_LABELS: Record<TaskRunState, string> = {
  queued: 'Queued',
  running: 'Working',
};

const KANBAN_CARD_MENU_REQUIRED_RIGHT_SPACE = 220;

export function resolveRunStateFrameStyle(runState: TaskRunState | null | undefined) {
  if (runState === 'queued') {
    return {
      '--wave-band-top': 'clamp(56px, 44%, 80px)',
    } as React.CSSProperties;
  }
  if (runState === 'running') {
    return {
      '--wave-band-top': '80px',
      '--wave-band-top-clearance': '26px',
    } as React.CSSProperties;
  }
  return undefined;
}

export function resolveLabelHashStyle(swatch: string) {
  return {
    color: swatch,
  } as React.CSSProperties;
}

export function resolveKanbanCardMenuPosition({
  triggerLeft,
  viewportWidth,
  requiredRightSpace = KANBAN_CARD_MENU_REQUIRED_RIGHT_SPACE,
}: {
  triggerLeft: number;
  viewportWidth: number;
  requiredRightSpace?: number;
}): 'bottom-start' | 'bottom-end' {
  return viewportWidth - triggerLeft >= requiredRightSpace ? 'bottom-start' : 'bottom-end';
}

const QUEUED_WAVE_PATHS = [
  'M0 46 C60 42 120 42 180 46 S300 50 360 46 S480 42 540 46 S660 50 720 46 L720 80 L0 80 Z',
  'M0 48 C60 44 120 44 180 48 S300 52 360 48 S480 44 540 48 S660 52 720 48 L720 80 L0 80 Z',
] as const;

const RUNNING_WAVE_PATHS = [
  'M0 38 C90 22 150 22 240 38 S390 54 480 38 S630 22 720 38 L720 80 L0 80 Z',
  'M0 35 C90 21 150 21 240 35 S390 49 480 35 S630 21 720 35 L720 80 L0 80 Z',
] as const;

export function getRunStateWaveConfig(runState: TaskRunState) {
  if (runState === 'queued') {
    return {
      paths: QUEUED_WAVE_PATHS,
      waveHeight: 116,
      waveShiftPercent: -32,
      bandTopClearance: 0,
    };
  }

  return {
    paths: RUNNING_WAVE_PATHS,
    waveHeight: 128,
    waveShiftPercent: -26,
    bandTopClearance: 26,
  };
}

function KanbanRunStateDecor({ runState }: { runState: TaskRunState }) {
  const { paths } = getRunStateWaveConfig(runState);
  return (
    <div className={styles.kanbanRunStateDecor} data-run-state-decor={runState} aria-hidden="true">
      <div className={styles.kanbanRunToneTop} />
      <div className={styles.kanbanRunToneBottom} />
      <div className={styles.kanbanRunWaveBand}>
        {paths.map((path, index) => (
          <svg
            // Layer count is fixed and stable.
            key={path}
            className={`${styles.kanbanRunWave} ${styles[`kanbanRunWaveLayer${index + 1}` as keyof typeof styles]}`}
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path d={path} />
            <path d={path} transform="translate(720 0)" />
          </svg>
        ))}
      </div>
    </div>
  );
}

export type KanbanCardContentProps = {
  task: KanbanTask;
  isPending: boolean;
  editHref: string;
  telegramEnabled?: boolean;
  onTaskQueued?: (taskKey: string, queuedAt: string) => void;
  onQuickMoveTask: (taskId: string, targetStatus: KanbanStatus) => void;
  onDeleteTask: (taskId: string) => void;
  enginePresets?: EnginePresets | null;
  labelOptions?: Array<{ id: string; name: string; color: string }>;
  onUpdateTaskLabels?: (taskKey: string, labelIds: string[]) => Promise<void>;
};

type KanbanCardMenuDropdownProps = {
  task: KanbanTask;
  isPending: boolean;
  editHref: string;
  telegramEnabled: boolean;
  telegramDispatchSummary?: ReactNode;
  isSendingTelegram: boolean;
  onQuickMoveTask: (taskId: string, targetStatus: KanbanStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onCopyTaskId: () => void;
  onCopyTelegramMessage: () => void;
  onSendTelegramMessage: () => void;
};

function toDispatchModeLabel(status: KanbanStatus) {
  switch (resolveTaskDispatchVerb(status)) {
    case 'plan':
      return 'Plan';
    case 'implement':
      return 'Implement';
    case 'review':
      return 'Review';
    case 'qa':
      return 'QA';
    default:
      return 'Status';
  }
}

export function renderTelegramDispatchTarget(dispatchTarget: KanbanTask['dispatchTarget']) {
  if (dispatchTarget === 'hermes-telegram') {
    return (
      <span className="task-dispatch-target-option">
        <img
          className="task-dispatch-target-logo"
          src="/icons/hermes-agent.png"
          alt=""
          width={16}
          height={16}
          aria-hidden="true"
        />
        <span>Telegram</span>
      </span>
    );
  }

  return (
    <span className="task-dispatch-target-option">
      <span className="task-dispatch-target-emoji" aria-hidden="true">
        🦞
      </span>
      <span>Telegram</span>
    </span>
  );
}

export function KanbanCardMenuDropdown({
  task,
  isPending,
  editHref,
  telegramEnabled,
  telegramDispatchSummary,
  isSendingTelegram,
  onQuickMoveTask,
  onDeleteTask,
  onCopyTaskId,
  onCopyTelegramMessage,
  onSendTelegramMessage,
}: KanbanCardMenuDropdownProps) {
  const terminology = useTerminology();
  return (
    <Menu.Dropdown>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'inbox')}
        disabled={isPending || task.status === 'inbox'}
      >
        Move to Inbox
      </Menu.Item>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'todo')}
        disabled={isPending || task.status === 'todo'}
      >
        Move to {boardStatusLabel('todo', terminology)}
      </Menu.Item>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'hold')}
        disabled={isPending || task.status === 'hold'}
      >
        Move to {boardStatusLabel('hold', terminology)}
      </Menu.Item>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'ready')}
        disabled={isPending || task.status === 'ready'}
      >
        Move to {boardStatusLabel('ready', terminology)}
      </Menu.Item>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'done')}
        disabled={isPending || task.status === 'done'}
      >
        Move to {boardStatusLabel('done', terminology)}
      </Menu.Item>
      <Menu.Item
        onClick={() => onQuickMoveTask(task.id, 'archived')}
        disabled={isPending || task.status === 'archived'}
      >
        Move to Archived
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item leftSection={<IconCopy size={14} />} onClick={onCopyTaskId}>
        {`Copy ${terminology.task.singular} ID`}
      </Menu.Item>
      <Menu.Item leftSection={<IconCopy size={14} />} onClick={onCopyTelegramMessage}>
        Copy Telegram Message
      </Menu.Item>
      {telegramEnabled ? (
        <Menu.Item
          leftSection={<IconSend size={14} />}
          onClick={onSendTelegramMessage}
          disabled={isSendingTelegram}
        >
          <>
            <span>Send Telegram Message</span>
            {telegramDispatchSummary ? (
              <Text
                component="span"
                display="block"
                pt={2}
                size="xs"
                c="dimmed"
                data-kanban-dispatch-detail="true"
              >
                {telegramDispatchSummary}
              </Text>
            ) : null}
          </>
        </Menu.Item>
      ) : null}
      <Menu.Divider />
      <Menu.Item component={Link} href={editHref}>
        Edit
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" onClick={() => onDeleteTask(task.id)} disabled={isPending}>
        Delete
      </Menu.Item>
    </Menu.Dropdown>
  );
}

export const KanbanCardContent = memo(function KanbanCardContent({
  task,
  isPending,
  editHref,
  telegramEnabled = false,
  onTaskQueued,
  onQuickMoveTask,
  onDeleteTask,
  enginePresets,
  labelOptions = [],
  onUpdateTaskLabels,
}: KanbanCardContentProps) {
  const terminology = useTerminology();
  const timeZone = useTimeZone();
  const taskLabel = task.title;
  const doneStatusLabel = boardStatusLabel('done', terminology).toLowerCase();
  const runStateLabel = task.runState ? RUN_STATE_LABELS[task.runState] : null;
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'bottom-start' | 'bottom-end'>('bottom-end');
  const primaryLabel = task.labels[0] ?? null;
  const additionalLabels = task.labels.slice(1);
  const hiddenLabelCount = additionalLabels.length;
  const hiddenLabelTooltip = additionalLabels.map((label) => `# ${label.name}`).join(', ');
  const displayEngine = resolveDisplayEngine(task.engine, task.status, enginePresets ?? null);
  const engineConfig = getEngineConfig(displayEngine);
  const checklistCounts = parseChecklistCounts(task.note);
  const taskPriority = parseTaskPriority(task.taskPriority);
  const doneActionLabel =
    task.status === 'done' ? `Already ${doneStatusLabel}` : `Mark as ${doneStatusLabel}`;
  const labelTooltipBackground = 'rgba(11, 20, 38, 0.96)';
  const labelTooltipBorder = '1px solid rgba(255, 255, 255, 0.08)';
  const labelTooltipText = '#f5f8ff';
  const hasPriorityIcon = taskPriority !== 'none';
  const canEditLabels = Boolean(onUpdateTaskLabels) && labelOptions.length > 0;
  const hasFooterMeta = Boolean(
    task.runState || task.dueAt || engineConfig || checklistCounts || primaryLabel || canEditLabels,
  );
  const labelTooltipStyles = {
    arrow: {
      background: labelTooltipBackground,
      border: labelTooltipBorder,
    },
    tooltip: {
      background: labelTooltipBackground,
      border: labelTooltipBorder,
      boxShadow: 'var(--ui-elevation-2)',
      color: labelTooltipText,
    },
  } as const;

  const renderLabelInline = (label: (typeof task.labels)[number]) => (
    <>
      <span
        className={styles.kanbanLabelHash}
        aria-hidden="true"
        style={resolveLabelHashStyle(resolveTaskLabelSwatchColor(label.color))}
      >
        #
      </span>
      <span className={styles.kanbanLabelName}>{label.name}</span>
    </>
  );

  const renderLabelTooltipItem = (label: (typeof task.labels)[number]) => (
    <span key={label.id} className={styles.kanbanLabelTooltipItem}>
      {renderLabelInline(label)}
    </span>
  );

  const telegramMessage = buildTaskTelegramMessage({
    taskKey: task.taskKey,
    status: task.status,
    engine: displayEngine,
    branchName: task.branch ?? null,
  });
  const telegramEngineConfig = getEngineConfig(displayEngine) ?? ENGINE_CONFIGS.codex;
  const telegramDispatchSummary = (
    <>
      <span>Engine: {telegramEngineConfig.label} | Target: </span>
      {renderTelegramDispatchTarget(task.dispatchTarget)}
      <span> | Mode: {toDispatchModeLabel(task.status)}</span>
    </>
  );

  const prepareCardMenuPosition = (trigger: HTMLButtonElement) => {
    if (typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    setMenuPosition(
      resolveKanbanCardMenuPosition({
        triggerLeft: rect.left,
        viewportWidth: window.innerWidth,
      }),
    );
  };

  const copyTaskId = async () => {
    try {
      await navigator.clipboard.writeText(task.taskKey);
      showSuccessNotification(`${terminology.task.singular} ID copied.`);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : `Failed to copy ${terminology.task.singular} ID`;
      showErrorNotification(message);
    }
  };

  const copyTelegramMessage = async () => {
    try {
      await navigator.clipboard.writeText(telegramMessage);
      showSuccessNotification('Telegram message copied.');
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to copy Telegram message';
      showErrorNotification(message);
    }
  };

  const sendTelegramMessage = async () => {
    if (isSendingTelegram) return;

    setIsSendingTelegram(true);
    try {
      const result = await sendTaskTelegramMessage(task.taskKey, telegramMessage);
      if (!result.ok) {
        showErrorNotification(result.error);
        return;
      }

      const queuedAt = new Date().toISOString();
      onTaskQueued?.(task.taskKey, queuedAt);
      showSuccessNotification('Telegram message sent.');
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to send Telegram message';
      showErrorNotification(message);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div
      className={styles.kanbanCardFrame}
      data-run-state={task.runState ?? undefined}
      data-run-state-active={task.runState ? 'true' : undefined}
      style={resolveRunStateFrameStyle(task.runState)}
    >
      {task.runState ? <KanbanRunStateDecor runState={task.runState} /> : null}
      <div className={styles.kanbanCardBody}>
        <div className={styles.kanbanCardHead}>
          <div
            className={`kanban-drag-handle ${styles.kanbanCardTopRow}`}
            data-kanban-top-row="true"
          >
            <Tooltip
              label={doneActionLabel}
              withArrow
              events={{ hover: true, focus: true, touch: false }}
            >
              <ActionIcon
                size={26}
                radius="xl"
                variant="subtle"
                color="gray"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  if (task.status !== 'done') {
                    onQuickMoveTask(task.id, 'done');
                  }
                }}
                disabled={isPending}
                aria-label={doneActionLabel}
                className={`kanban-status-button is-${task.status} ${styles.kanbanCardStatusAction}`}
              >
                <KanbanStatusIndicator status={task.status} />
              </ActionIcon>
            </Tooltip>

            <div className={styles.kanbanCardKeyRow} data-kanban-key-row="true">
              <Text className={styles.kanbanCardKey}>{task.taskKey}</Text>
              {hasPriorityIcon ? (
                <span className={styles.kanbanCardKeyPriority} data-kanban-title-priority="true">
                  <TaskPriorityIcon priority={taskPriority} size={12} />
                </span>
              ) : null}
            </div>

            <div className={styles.kanbanCardMenuSlot}>
              <Menu position={menuPosition} shadow="md" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    size={28}
                    radius="xl"
                    variant="subtle"
                    color="gray"
                    className={styles.kanbanCardMenuTrigger}
                    aria-label={`Open actions for ${taskLabel}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      prepareCardMenuPosition(event.currentTarget);
                    }}
                    onClick={(event) => {
                      prepareCardMenuPosition(event.currentTarget);
                    }}
                  >
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <KanbanCardMenuDropdown
                  task={task}
                  isPending={isPending}
                  editHref={editHref}
                  telegramEnabled={telegramEnabled}
                  telegramDispatchSummary={telegramDispatchSummary}
                  isSendingTelegram={isSendingTelegram}
                  onQuickMoveTask={onQuickMoveTask}
                  onDeleteTask={onDeleteTask}
                  onCopyTaskId={copyTaskId}
                  onCopyTelegramMessage={copyTelegramMessage}
                  onSendTelegramMessage={sendTelegramMessage}
                />
              </Menu>
            </div>
          </div>

          <div className={styles.kanbanCardTaskCopy} data-kanban-task-copy="true">
            <Text className={styles.kanbanCardTitle}>{task.title}</Text>
          </div>
        </div>

        {hasFooterMeta ? (
          <div className={styles.kanbanMetaStack}>
            <div className={styles.kanbanFooterBand} data-kanban-footer-band="true">
              <div className={styles.kanbanFooterBandTrack}>
                <div className={styles.kanbanFooterMetaGroup} data-kanban-footer-group="primary">
                  {task.runState ? (
                    <span
                      className={`${styles.kanbanMetaChip} ${styles.kanbanRunStateChip}`}
                      data-run-state-chip={task.runState}
                    >
                      <span className={styles.kanbanRunStateDot} aria-hidden="true" />
                      {runStateLabel}
                    </span>
                  ) : null}

                  {task.dueAt ? (
                    <span className={styles.kanbanMetaChip} data-kanban-chip="due">
                      Due {formatDateForDisplay(task.dueAt, timeZone)}
                    </span>
                  ) : null}

                  {engineConfig ? (
                    <span className={styles.kanbanMetaChip} data-kanban-chip="engine">
                      <Image src={engineConfig.icon} alt={engineConfig.label} w={12} h={12} />
                      <span className={styles.kanbanMetaChipText}>{engineConfig.label}</span>
                    </span>
                  ) : null}

                  {checklistCounts ? (
                    <span className={styles.kanbanMetaChip} data-kanban-chip="checklist">
                      <span className={styles.kanbanMetaChipIcon} data-kanban-checklist-icon="true">
                        <IconChecklist size={12} />
                      </span>
                      {checklistCounts.done}/{checklistCounts.total}
                    </span>
                  ) : null}
                </div>

                <div className={styles.kanbanFooterMetaGroup} data-kanban-footer-group="secondary">
                  {canEditLabels && onUpdateTaskLabels ? (
                    <KanbanCardLabelShortcut
                      task={task}
                      labelOptions={labelOptions}
                      isPending={isPending}
                      onUpdateTaskLabels={onUpdateTaskLabels}
                      renderLabelInline={renderLabelInline}
                      renderLabelTooltipItem={renderLabelTooltipItem}
                      labelTooltipStyles={labelTooltipStyles}
                    />
                  ) : primaryLabel ? (
                    <Tooltip
                      classNames={{ tooltip: styles.kanbanLabelTooltipSurface }}
                      label={
                        <div className={styles.kanbanLabelTooltip}>
                          {renderLabelTooltipItem(primaryLabel)}
                        </div>
                      }
                      styles={labelTooltipStyles}
                      withArrow
                      openDelay={0}
                    >
                      <span className={styles.kanbanLabelText} data-kanban-label="primary">
                        {renderLabelInline(primaryLabel)}
                      </span>
                    </Tooltip>
                  ) : null}

                  {!canEditLabels && hiddenLabelCount > 0 ? (
                    <Tooltip
                      classNames={{ tooltip: styles.kanbanLabelTooltipSurface }}
                      label={
                        <div className={styles.kanbanLabelTooltip}>
                          {additionalLabels.map((label) => renderLabelTooltipItem(label))}
                        </div>
                      }
                      styles={labelTooltipStyles}
                      withArrow
                      openDelay={0}
                      multiline
                    >
                      <span
                        className={styles.kanbanLabelSummary}
                        data-kanban-label-summary="true"
                        title={hiddenLabelTooltip}
                        aria-label={hiddenLabelTooltip}
                      >
                        +{hiddenLabelCount}
                      </span>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
