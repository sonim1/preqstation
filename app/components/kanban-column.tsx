'use client';

import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Badge, Group, Paper, Title } from '@mantine/core';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ReactNode } from 'react';

import { KanbanEmptyLane } from '@/app/components/kanban-empty-lane';
import type { EnginePresets, KanbanStatus, KanbanTask } from '@/lib/kanban-helpers';
import { boardStatusLabel, statusColors } from '@/lib/kanban-helpers';

import cardStyles from './cards.module.css';
import { KanbanCardContent } from './kanban-card';
import { useTerminology } from './terminology-provider';

function shouldIgnoreCardSurfaceEvent(target: HTMLElement) {
  return Boolean(
    target.closest("button, a, input, select, textarea, [role='menu'], .mantine-Menu-dropdown"),
  );
}

type KanbanColumnProps = {
  status: KanbanStatus;
  statusLabel?: string;
  tasks: KanbanTask[];
  isPending: boolean;
  isMobile: boolean;
  editHrefBase: string;
  editHrefJoiner: string;
  telegramEnabled?: boolean;
  router: AppRouterInstance;
  onTaskQueued?: (taskKey: string, queuedAt: string) => void;
  onOpenTaskEditor?: (task: KanbanTask) => void;
  onQuickMoveTask: (taskId: string, targetStatus: KanbanStatus) => void;
  onDeleteTask: (taskId: string) => void;
  labelOptions?: Array<{ id: string; name: string; color: string }>;
  onUpdateTaskLabels?: (taskKey: string, labelIds: string[]) => Promise<void>;
  enginePresets?: EnginePresets | null;
  headerActions?: ReactNode;
  className?: string;
};

export function KanbanColumn({
  status,
  statusLabel,
  tasks,
  isPending,
  isMobile,
  editHrefBase,
  editHrefJoiner,
  telegramEnabled = false,
  router,
  onTaskQueued,
  onOpenTaskEditor,
  onQuickMoveTask,
  onDeleteTask,
  labelOptions = [],
  onUpdateTaskLabels,
  enginePresets,
  headerActions,
  className,
}: KanbanColumnProps) {
  const terminology = useTerminology();
  const label = statusLabel ?? boardStatusLabel(status, terminology);

  return (
    <Paper p="sm" className={className ? `kanban-column ${className}` : 'kanban-column'}>
      <Group justify="space-between" mb="sm" className="kanban-column-header">
        <Title order={4}>{label}</Title>
        <Group gap={6} align="center">
          <Badge color={statusColors[status]} variant="light">
            {tasks.length}
          </Badge>
          {headerActions}
        </Group>
      </Group>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`kanban-column-body${snapshot.isDraggingOver ? ' is-drag-over' : ''}`}
          >
            <div className="kanban-column-list kanban-fill-height kanban-bottom-clearance">
              {tasks.length === 0 && !snapshot.isDraggingOver ? (
                <KanbanEmptyLane className="kanban-empty-state--compact kanban-fill-height" />
              ) : null}
              {tasks.map((task, index) => (
                <Draggable
                  key={task.id}
                  draggableId={task.id}
                  index={index}
                  isDragDisabled={isMobile || isPending}
                >
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        ...(snapshot.isDropAnimating ? { transitionDuration: '0.001s' } : {}),
                        cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                      }}
                      p={0}
                      radius={6}
                      className={`${cardStyles.itemCard} ${cardStyles.kanbanCard}${snapshot.isDragging ? ` ${cardStyles.isDragging}` : ''}`}
                      data-run-state={task.runState ?? undefined}
                      role="link"
                      tabIndex={snapshot.isDragging ? -1 : 0}
                      aria-label={`Open task ${task.taskKey} ${task.title}`}
                      onClick={(e) => {
                        if (snapshot.isDragging) return;
                        const target = e.target as HTMLElement;
                        if (shouldIgnoreCardSurfaceEvent(target)) return;
                        if (onOpenTaskEditor) {
                          onOpenTaskEditor(task);
                          return;
                        }
                        router.push(
                          `${editHrefBase}${editHrefJoiner}taskId=${encodeURIComponent(task.taskKey)}`,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (snapshot.isDragging) return;
                        if (event.currentTarget !== event.target) return;
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        if (onOpenTaskEditor) {
                          onOpenTaskEditor(task);
                          return;
                        }
                        router.push(
                          `${editHrefBase}${editHrefJoiner}taskId=${encodeURIComponent(task.taskKey)}`,
                        );
                      }}
                    >
                      <KanbanCardContent
                        task={task}
                        isPending={isPending}
                        editHref={`${editHrefBase}${editHrefJoiner}taskId=${encodeURIComponent(task.taskKey)}`}
                        telegramEnabled={telegramEnabled}
                        onTaskQueued={onTaskQueued}
                        onQuickMoveTask={onQuickMoveTask}
                        onDeleteTask={onDeleteTask}
                        enginePresets={enginePresets ?? null}
                        labelOptions={labelOptions}
                        onUpdateTaskLabels={onUpdateTaskLabels}
                      />
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <div className="kanban-column-drop-tail" aria-hidden="true" />
              <div className="kanban-bottom-gradient" aria-hidden="true" />
            </div>
          </div>
        )}
      </Droppable>
    </Paper>
  );
}
