'use client';

import { Tooltip } from '@mantine/core';
import { type CSSProperties, type ReactNode, type SyntheticEvent, useState } from 'react';

import type { KanbanTask } from '@/lib/kanban-helpers';
import { showErrorNotification } from '@/lib/notifications';

import styles from './cards.module.css';
import { TaskLabelPicker } from './task-label-picker';

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
  onProjectLabelOptionsChange?: (projectId: string, labelOptions: LabelOption[]) => void;
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
  onProjectLabelOptionsChange,
  renderLabelInline,
  renderLabelTooltipItem,
  labelTooltipStyles,
}: KanbanCardLabelShortcutProps) {
  const [isSaving, setIsSaving] = useState(false);
  const selectedLabelIds = task.labels.map((label) => label.id);
  const primaryLabel = task.labels[0] ?? null;
  const additionalLabels = task.labels.slice(1);
  const hiddenLabelCount = additionalLabels.length;
  const hiddenLabelTooltip = additionalLabels.map((label) => `# ${label.name}`).join(', ');

  const updateLabels = async (nextLabelIds: string[]) => {
    if (isPending || isSaving) return;

    setIsSaving(true);
    try {
      await onUpdateTaskLabels(task.taskKey, nextLabelIds);
    } catch (error) {
      showErrorNotification(
        error instanceof Error && error.message ? error.message : 'Failed to save labels.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TaskLabelPicker
      labelOptions={labelOptions}
      selectedLabelIds={selectedLabelIds}
      selectedLabels={task.labels}
      projectId={task.project?.id ?? null}
      triggerAriaLabel={`Edit labels for ${task.title}`}
      disabled={isPending || isSaving}
      onTriggerPointerDown={stopCardOpen}
      onTriggerClick={stopCardOpen}
      onChange={(nextLabelIds) => {
        void updateLabels(nextLabelIds);
      }}
      onOptionsChange={(nextLabelOptions) => {
        if (task.project?.id) {
          onProjectLabelOptionsChange?.(
            task.project.id,
            nextLabelOptions.map((label) => ({
              id: label.id,
              name: label.name,
              color: label.color ?? 'blue',
            })),
          );
        }
      }}
      renderTrigger={() => (
        <span
          className={styles.kanbanLabelShortcutButton}
          data-kanban-label-shortcut={primaryLabel ? 'labels' : 'empty'}
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
        </span>
      )}
    />
  );
}
