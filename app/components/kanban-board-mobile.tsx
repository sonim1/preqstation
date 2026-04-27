'use client';

import { Paper, Tabs, Text } from '@mantine/core';
import {
  IconCircleCheck,
  IconEye,
  IconInbox,
  IconListCheck,
  IconPlayerPause,
  IconRefresh,
} from '@tabler/icons-react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { type ComponentType, type CSSProperties, useEffect, useRef } from 'react';

import { useMobilePullToRefresh } from '@/app/hooks/use-mobile-pull-to-refresh';
import { useMobileTabSwipe } from '@/app/hooks/use-mobile-tab-swipe';
import {
  boardStatusLabel,
  type EnginePresets,
  getMobileBoardStatuses,
  type KanbanColumns,
  type KanbanStatus,
  type KanbanTask,
} from '@/lib/kanban-helpers';
import { showSuccessNotification } from '@/lib/notifications';

import cardStyles from './cards.module.css';
import { KanbanCardContent } from './kanban-card';
import { KanbanEmptyLane } from './kanban-empty-lane';
import { useTerminology } from './terminology-provider';

function shouldIgnoreCardSurfaceEvent(target: HTMLElement) {
  return Boolean(
    target.closest("button, a, input, select, textarea, [role='menu'], .mantine-Menu-dropdown"),
  );
}

const mobileStatusIcons: Record<string, ComponentType<{ size?: number }>> = {
  inbox: IconInbox,
  todo: IconListCheck,
  hold: IconPlayerPause,
  ready: IconEye,
  done: IconCircleCheck,
};

type KanbanBoardMobileProps = {
  columns: KanbanColumns;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isPending: boolean;
  editHrefBase: string;
  editHrefJoiner: string;
  telegramEnabled?: boolean;
  router: AppRouterInstance;
  onRefresh?: () => void;
  onTaskQueued?: (taskKey: string, queuedAt: string) => void;
  onOpenTaskEditor?: (task: KanbanTask) => void;
  onQuickMoveTask: (taskId: string, targetStatus: KanbanStatus) => void;
  onDeleteTask: (taskId: string) => void;
  labelOptions?: Array<{ id: string; name: string; color: string }>;
  onUpdateTaskLabels?: (taskKey: string, labelIds: string[]) => Promise<void>;
  saveError: string | null;
  enginePresets?: EnginePresets | null;
};

export function KanbanBoardMobile({
  columns,
  activeTab,
  onTabChange,
  isPending,
  editHrefBase,
  editHrefJoiner,
  telegramEnabled = false,
  router,
  onRefresh = () => {},
  onTaskQueued,
  onOpenTaskEditor,
  onQuickMoveTask,
  onDeleteTask,
  labelOptions = [],
  onUpdateTaskLabels,
  saveError,
  enginePresets,
}: KanbanBoardMobileProps) {
  const terminology = useTerminology();
  const mobileStatuses = getMobileBoardStatuses(columns, activeTab);
  const swipeHandlers = useMobileTabSwipe(mobileStatuses, activeTab, onTabChange);
  const pullRefreshRequestedRef = useRef(false);
  const pullRefreshPendingRef = useRef(false);

  useEffect(() => {
    if (!pullRefreshRequestedRef.current) return;
    if (isPending) {
      pullRefreshPendingRef.current = true;
      return;
    }
    if (!pullRefreshPendingRef.current) return;

    pullRefreshRequestedRef.current = false;
    pullRefreshPendingRef.current = false;
    showSuccessNotification('Board refreshed.');
  }, [isPending]);

  const pullToRefresh = useMobilePullToRefresh({
    activeTab,
    disabled: isPending,
    onRefresh: () => {
      pullRefreshRequestedRef.current = true;
      pullRefreshPendingRef.current = false;
      onRefresh();
    },
  });

  return (
    <Tabs value={activeTab} onChange={(v) => v && onTabChange(v)} className="kanban-mobile-tabs">
      <Tabs.List>
        {mobileStatuses.map((status) => {
          const StatusIcon = mobileStatusIcons[status];
          return (
            <Tabs.Tab key={status} value={status} className="kanban-mobile-tab">
              <span className="kanban-mobile-tab-shell">
                <span className="kanban-mobile-tab-copy">
                  {StatusIcon ? (
                    <span className="kanban-mobile-tab-icon" aria-hidden="true">
                      <StatusIcon size={13} />
                    </span>
                  ) : null}
                  <span className="kanban-mobile-tab-label">
                    {boardStatusLabel(status, terminology)}
                  </span>
                </span>
                <span className="kanban-mobile-tab-count">{columns[status].length}</span>
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      <div {...swipeHandlers} className="kanban-mobile-panels" style={{ touchAction: 'pan-y' }}>
        {mobileStatuses.map((status) => {
          const isActivePanel = status === activeTab;
          const panelBodyStyle = isActivePanel
            ? ({
                '--kanban-mobile-refresh-offset': `${pullToRefresh.pullDistance}px`,
                '--kanban-mobile-refresh-progress': pullToRefresh.pullProgress,
                '--kanban-mobile-refresh-progress-percent': `${Math.round(
                  pullToRefresh.pullProgress * 100,
                )}%`,
              } as CSSProperties)
            : undefined;
          const tasks = columns[status];
          return (
            <Tabs.Panel key={status} value={status} className="kanban-mobile-panel">
              <div
                ref={isActivePanel ? pullToRefresh.bindScrollContainer : undefined}
                className="kanban-mobile-panel-body kanban-fill-height"
                onTouchStart={isActivePanel ? pullToRefresh.onTouchStart : undefined}
                onTouchMove={isActivePanel ? pullToRefresh.onTouchMove : undefined}
                onTouchEnd={isActivePanel ? pullToRefresh.onTouchEnd : undefined}
                onTouchCancel={isActivePanel ? pullToRefresh.onTouchCancel : undefined}
                style={panelBodyStyle}
              >
                {isActivePanel ? (
                  <div
                    className="kanban-mobile-refresh-indicator"
                    data-visible={pullToRefresh.pullDistance > 0 ? 'true' : undefined}
                    data-armed={pullToRefresh.isArmed ? 'true' : undefined}
                    aria-hidden="true"
                  >
                    <span className="kanban-mobile-refresh-icon">
                      <IconRefresh size={22} stroke={2.1} />
                    </span>
                  </div>
                ) : null}
                <div className="kanban-mobile-panel-list kanban-fill-height kanban-bottom-clearance">
                  {tasks.length === 0 ? (
                    <KanbanEmptyLane className="kanban-empty-state--compact kanban-fill-height" />
                  ) : (
                    tasks.map((task) => {
                      const editHref = `${editHrefBase}${editHrefJoiner}taskId=${encodeURIComponent(task.taskKey)}`;
                      return (
                        <Paper
                          key={task.id}
                          p={0}
                          radius={6}
                          className={`${cardStyles.itemCard} ${cardStyles.kanbanCard} kanban-mobile-card`}
                          data-run-state={task.runState ?? undefined}
                          role="link"
                          tabIndex={0}
                          aria-label={`Open task ${task.taskKey} ${task.title}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (shouldIgnoreCardSurfaceEvent(target)) return;
                            if (onOpenTaskEditor) {
                              onOpenTaskEditor(task);
                              return;
                            }
                            router.push(editHref);
                          }}
                          onKeyDown={(event) => {
                            if (event.currentTarget !== event.target) return;
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            if (onOpenTaskEditor) {
                              onOpenTaskEditor(task);
                              return;
                            }
                            router.push(editHref);
                          }}
                        >
                          <KanbanCardContent
                            task={task}
                            isPending={isPending}
                            isMobile
                            editHref={editHref}
                            telegramEnabled={telegramEnabled}
                            onTaskQueued={onTaskQueued}
                            onQuickMoveTask={onQuickMoveTask}
                            onDeleteTask={onDeleteTask}
                            enginePresets={enginePresets ?? null}
                            labelOptions={labelOptions}
                            onUpdateTaskLabels={onUpdateTaskLabels}
                          />
                        </Paper>
                      );
                    })
                  )}
                  <div className="kanban-column-drop-tail" aria-hidden="true" />
                  <div className="kanban-bottom-gradient" aria-hidden="true" />
                </div>
              </div>
            </Tabs.Panel>
          );
        })}
      </div>
      {saveError ? (
        <Text c="red" size="sm" mt="sm">
          {saveError}
        </Text>
      ) : null}
    </Tabs>
  );
}
