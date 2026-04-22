'use client';

import { Menu, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { type CSSProperties, type ReactNode, type SyntheticEvent, useState } from 'react';

import type { KanbanTask } from '@/lib/kanban-helpers';
import { resolveTaskLabelSwatchColor } from '@/lib/task-meta';

import styles from './cards.module.css';

type LabelOption = {
  id: string;
  name: string;
  color: string;
};

type KanbanCardLabelShortcutProps = {
  task: KanbanTask;
  labelOptions: LabelOption[];
  isPending: boolean;
  onUpdateTaskLabels: (taskKey: string, labelIds: string[]) => Promise<void>;
  renderLabelInline: (label: KanbanTask['labels'][number]) => ReactNode;
  renderLabelTooltipItem: (label: KanbanTask['labels'][number]) => ReactNode;
  labelTooltipStyles: {
    arrow: CSSProperties;
    tooltip: CSSProperties;
  };
};

function stopCardOpen(event: SyntheticEvent) {
  event.stopPropagation();
}

export function KanbanCardLabelShortcut({
  task,
  labelOptions,
  isPending,
  onUpdateTaskLabels,
  renderLabelInline,
  renderLabelTooltipItem,
  labelTooltipStyles,
}: KanbanCardLabelShortcutProps) {
  const [opened, setOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedLabelIds = task.labels.map((label) => label.id);
  const primaryLabel = task.labels[0] ?? null;
  const additionalLabels = task.labels.slice(1);
  const hiddenLabelCount = additionalLabels.length;
  const hiddenLabelTooltip = additionalLabels.map((label) => `# ${label.name}`).join(', ');

  const toggleLabel = async (labelId: string) => {
    if (isPending || isSaving) return;

    const nextLabelIds = selectedLabelIds.includes(labelId)
      ? selectedLabelIds.filter((currentLabelId) => currentLabelId !== labelId)
      : [...selectedLabelIds, labelId];

    setIsSaving(true);
    try {
      await onUpdateTaskLabels(task.taskKey, nextLabelIds);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      shadow="md"
      withinPortal
      closeOnItemClick={false}
    >
      <Menu.Target>
        <UnstyledButton
          type="button"
          className={styles.kanbanLabelShortcutButton}
          data-kanban-label-shortcut={primaryLabel ? 'labels' : 'empty'}
          aria-label={`Edit labels for ${task.title}`}
          onPointerDown={stopCardOpen}
          onClick={stopCardOpen}
          disabled={isPending || isSaving}
        >
          {primaryLabel ? (
            <span className={styles.kanbanLabelShortcutSurface}>
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

              {hiddenLabelCount > 0 ? (
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
            </span>
          ) : (
            <span className={styles.kanbanLabelShortcutEmpty}>#</span>
          )}
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown onPointerDown={stopCardOpen} onClick={stopCardOpen}>
        {labelOptions.map((label) => {
          const isSelected = selectedLabelIds.includes(label.id);

          return (
            <Menu.Item
              key={label.id}
              role="menuitemcheckbox"
              aria-checked={isSelected}
              disabled={isPending || isSaving}
              leftSection={
                <span
                  className={styles.kanbanLabelShortcutMenuHash}
                  aria-hidden="true"
                  style={{ color: resolveTaskLabelSwatchColor(label.color) }}
                >
                  #
                </span>
              }
              rightSection={isSelected ? <IconCheck size={14} /> : null}
              onClick={() => {
                void toggleLabel(label.id);
              }}
            >
              {label.name}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
