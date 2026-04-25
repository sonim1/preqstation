'use client';

import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { ActionIcon, Button, Group, Menu, Modal, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconArchive,
  IconBulb,
  IconChevronDown,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { updateKanbanTaskLabelsFromBoard } from '@/lib/kanban-board-label-shortcut';
import {
  boardStatusLabel,
  buildUpdates,
  computeSortOrder,
  type EnginePresets,
  findTaskLocation,
  getBoardFlowStatuses,
  getMobileBoardStatuses,
  type KanbanColumns,
  type KanbanStatus,
  type KanbanTask,
  shouldShowHoldLane,
} from '@/lib/kanban-helpers';
import {
  drainKanbanMutationQueue,
  type QueuedKanbanMutation,
  shouldApplyKanbanServerSnapshot,
  shouldRefreshKanbanAfterPersist,
} from '@/lib/kanban-persistence';
import type { EditableBoardTask } from '@/lib/kanban-store';
import { selectKanbanColumns } from '@/lib/kanban-store';
import { subscribeMediaQuery } from '@/lib/match-media';
import { showErrorNotification } from '@/lib/notifications';
import type { QaRunView } from '@/lib/qa-runs';

import { useBoardOfflineSync } from './board-offline-sync-provider';
import { KanbanArchiveDrawer } from './kanban-archive-drawer';
import { KanbanBoardMobile } from './kanban-board-mobile';
import { KanbanColumn } from './kanban-column';
import { KanbanQuickAdd } from './kanban-quick-add';
import {
  useKanbanColumns,
  useKanbanStoreApi,
  useOpenFocusedTaskFromBoardTask,
  useSetKanbanReconciliationPaused,
} from './kanban-store-provider';
import { useOfflineStatus } from './offline-status-provider';
import { ProjectInsightModal } from './project-insight-modal';
import { ReadyQaActions } from './ready-qa-actions';
import { useTerminology } from './terminology-provider';

type ProjectOption = { id: string; name: string };
type SelectedProject = ProjectOption & { projectKey: string };
type LabelOption = { id: string; name: string; color: string };
type ReadyQaConfig = {
  projectId: string;
  projectKey: string;
  projectName: string;
  branchName: string;
  runs: QaRunView[];
};

type ArchivedTasksPage = {
  tasks: KanbanTask[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

type ArchivedDrawerPageState = {
  tasks: KanbanTask[];
  total: number;
  nextOffset: number;
  hasMore: boolean;
};

export type MoveIntentRequest = {
  taskKey: string;
  targetStatus: KanbanStatus;
  afterTaskKey: string | null;
  beforeTaskKey: string | null;
};

type MoveIntentTaskPatch = {
  taskKey: string;
  status: KanbanStatus;
  sortOrder: string;
  archivedAt?: string | null;
};

type MoveIntentResponse = {
  ok?: boolean;
  boardTask?: MoveIntentTaskPatch;
  repairedTasks?: MoveIntentTaskPatch[];
};

type KanbanBoardProps = {
  serverColumns?: KanbanColumns;
  initialInboxTasks?: KanbanTask[];
  initialTodoTasks?: KanbanTask[];
  initialHoldTasks?: KanbanTask[];
  initialReadyTasks?: KanbanTask[];
  initialDoneTasks?: KanbanTask[];
  initialArchivedTasks?: KanbanTask[];
  archivedCount?: number;
  archiveProjectId?: string | null;
  onArchivedCountChange?: Dispatch<SetStateAction<number>>;
  optimisticQueuedTask?: { taskKey: string; queuedAt: string } | null;
  editHrefBase: string;
  telegramEnabled?: boolean;
  projectOptions: ProjectOption[];
  labelOptions: LabelOption[];
  projectLabelOptionsByProjectId?: Record<string, LabelOption[]>;
  selectedProject: SelectedProject | null;
  enginePresets: EnginePresets | null;
  readyQaConfig?: ReadyQaConfig | null;
  onOpenTaskEditor?: (task: KanbanTask) => void;
};

const ARCHIVED_TASK_PAGE_SIZE = 30;

function buildInitialArchivedDrawerState(total: number): ArchivedDrawerPageState {
  return {
    tasks: [],
    total,
    nextOffset: 0,
    hasMore: false,
  };
}

export function buildMoveIntentRequest(params: {
  columns: KanbanColumns;
  taskKey: string;
  targetStatus: KanbanStatus;
}): MoveIntentRequest | null {
  const lane = params.columns[params.targetStatus];
  const movedIndex = lane.findIndex((task) => task.taskKey === params.taskKey);
  if (movedIndex < 0) {
    return null;
  }

  return {
    taskKey: params.taskKey,
    targetStatus: params.targetStatus,
    afterTaskKey: movedIndex > 0 ? lane[movedIndex - 1].taskKey : null,
    beforeTaskKey: movedIndex < lane.length - 1 ? lane[movedIndex + 1].taskKey : null,
  };
}

function buildMoveIntentServerSnapshots(params: {
  columns: KanbanColumns;
  response: MoveIntentResponse;
}): KanbanTask[] {
  const currentTasks = Object.values(params.columns).flat();
  const currentByTaskKey = new Map(currentTasks.map((task) => [task.taskKey, task]));
  const patches = [
    ...(params.response.boardTask ? [params.response.boardTask] : []),
    ...(params.response.repairedTasks ?? []),
  ];
  const seenTaskKeys = new Set<string>();

  return patches.flatMap((patch) => {
    if (seenTaskKeys.has(patch.taskKey)) {
      return [];
    }
    seenTaskKeys.add(patch.taskKey);

    const currentTask = currentByTaskKey.get(patch.taskKey);
    if (!currentTask) {
      return [];
    }

    return [
      {
        ...currentTask,
        status: patch.status,
        sortOrder: patch.sortOrder,
        archivedAt: patch.archivedAt !== undefined ? patch.archivedAt : currentTask.archivedAt,
      },
    ];
  });
}

export async function requestMoveIntent(
  fetchImpl: typeof fetch,
  request: MoveIntentRequest,
): Promise<MoveIntentResponse> {
  const response = await fetchImpl('/api/todos/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(request),
  });
  if (response.ok) {
    return ((await response.json()) as MoveIntentResponse) ?? {};
  }

  let detail = '';
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') {
      detail = payload.error;
    }
  } catch {
    /* ignore */
  }

  throw new Error(
    detail
      ? `Failed to persist task move (${response.status}): ${detail}`
      : `Failed to persist task move (${response.status})`,
  );
}

function resolveHydratedFocusedTask(
  focusedTask: EditableBoardTask | null,
  selectedProject: SelectedProject | null,
) {
  const boardProjectId = selectedProject?.id ?? null;
  return focusedTask?.projectId === boardProjectId ? focusedTask : null;
}

function removeArchivedDrawerTaskState(
  state: ArchivedDrawerPageState,
  taskId: string,
): ArchivedDrawerPageState {
  const taskExists = state.tasks.some((task) => task.id === taskId);
  const nextTotal = Math.max(0, state.total - 1);
  const nextOffset = taskExists ? Math.max(0, state.nextOffset - 1) : state.nextOffset;

  return {
    tasks: taskExists ? state.tasks.filter((task) => task.id !== taskId) : state.tasks,
    total: nextTotal,
    nextOffset,
    hasMore: nextOffset < nextTotal,
  };
}

export function resolveKanbanWheelAction(params: {
  deltaX: number;
  deltaY: number;
  boardScrollLeft: number;
  boardClientWidth: number;
  boardScrollWidth: number;
  columnScrollTop?: number;
  columnClientHeight?: number;
  columnScrollHeight?: number;
}) {
  const absX = Math.abs(params.deltaX);
  const absY = Math.abs(params.deltaY);
  const maxBoardScroll = Math.max(0, params.boardScrollWidth - params.boardClientWidth);

  if (
    typeof params.columnScrollTop === 'number' &&
    typeof params.columnClientHeight === 'number' &&
    typeof params.columnScrollHeight === 'number' &&
    absY > absX
  ) {
    const canScrollUp = params.columnScrollTop > 0;
    const canScrollDown =
      params.columnScrollTop + params.columnClientHeight < params.columnScrollHeight;

    if ((params.deltaY < 0 && canScrollUp) || (params.deltaY > 0 && canScrollDown)) {
      return { preventDefault: false, nextScrollLeft: params.boardScrollLeft };
    }

    return { preventDefault: true, nextScrollLeft: params.boardScrollLeft };
  }

  if (maxBoardScroll <= 0) {
    return { preventDefault: false, nextScrollLeft: params.boardScrollLeft };
  }

  const delta = absX > absY ? params.deltaX : params.deltaY;
  if (delta === 0) {
    return { preventDefault: false, nextScrollLeft: params.boardScrollLeft };
  }

  return {
    preventDefault: true,
    nextScrollLeft: Math.max(0, Math.min(maxBoardScroll, params.boardScrollLeft + delta)),
  };
}

export function buildArchivedTasksRequestPath(params: {
  projectId: string | null;
  query: string;
  limit: number;
  offset: number;
  summaryOnly?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.projectId) {
    searchParams.set('projectId', params.projectId);
  }

  const trimmedQuery = params.query.trim();
  if (trimmedQuery) {
    searchParams.set('q', trimmedQuery);
  }

  searchParams.set('limit', String(params.limit));
  searchParams.set('offset', String(params.offset));

  if (params.summaryOnly) {
    searchParams.set('summaryOnly', '1');
  }

  return `/api/todos/archived?${searchParams.toString()}`;
}

async function requestArchivedTasksPage(params: {
  projectId: string | null;
  query: string;
  limit: number;
  offset: number;
  summaryOnly?: boolean;
}) {
  const response = await fetch(buildArchivedTasksRequestPath(params), {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Archived tasks request failed: ${response.status}`);
  }

  return (
    ((await response.json()) as ArchivedTasksPage) ?? {
      tasks: [],
      total: 0,
      offset: params.offset,
      limit: params.limit,
      hasMore: false,
    }
  );
}

export function KanbanBoard({
  serverColumns,
  initialInboxTasks,
  initialTodoTasks,
  initialHoldTasks,
  initialReadyTasks,
  initialDoneTasks,
  initialArchivedTasks,
  archivedCount,
  archiveProjectId = null,
  onArchivedCountChange,
  optimisticQueuedTask: _optimisticQueuedTask = null,
  editHrefBase,
  telegramEnabled = false,
  projectOptions,
  labelOptions,
  projectLabelOptionsByProjectId = {},
  selectedProject,
  enginePresets,
  readyQaConfig = null,
  onOpenTaskEditor,
}: KanbanBoardProps) {
  const boardOfflineSync = useBoardOfflineSync();
  const { online } = useOfflineStatus();
  const terminology = useTerminology();
  const resolvedServerColumns = useMemo(
    () =>
      serverColumns ??
      ({
        inbox: initialInboxTasks ?? [],
        todo: initialTodoTasks ?? [],
        hold: initialHoldTasks ?? [],
        ready: initialReadyTasks ?? [],
        done: initialDoneTasks ?? [],
        archived: initialArchivedTasks ?? [],
      } satisfies KanbanColumns),
    [
      initialArchivedTasks,
      initialDoneTasks,
      initialHoldTasks,
      initialInboxTasks,
      initialReadyTasks,
      initialTodoTasks,
      serverColumns,
    ],
  );
  const resolvedArchivedCount = archivedCount ?? resolvedServerColumns.archived.length;
  const router = useRouter();
  const kanbanStore = useKanbanStoreApi();
  const openFocusedTaskFromBoardTask = useOpenFocusedTaskFromBoardTask();
  const setKanbanReconciliationPaused = useSetKanbanReconciliationPaused();
  const columns = useKanbanColumns();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [archiveDrawerOpened, setArchiveDrawerOpened] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archivedDrawerState, setArchivedDrawerState] = useState<ArchivedDrawerPageState>(() =>
    buildInitialArchivedDrawerState(resolvedArchivedCount),
  );
  const [isArchivedDrawerLoading, setIsArchivedDrawerLoading] = useState(false);
  const [isArchivedDrawerLoadingMore, setIsArchivedDrawerLoadingMore] = useState(false);
  const [archiveLoadMoreError, setArchiveLoadMoreError] = useState<string | null>(null);
  const [quickAddOpened, setQuickAddOpened] = useState(false);
  const [insightOpened, setInsightOpened] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    taskId: string;
    taskKey: string;
    title: string;
  } | null>(null);
  const columnsRef = useRef(columns);
  const persistQueueRef = useRef<QueuedKanbanMutation[]>([]);
  const isPersistingRef = useRef(false);
  const archiveRequestIdRef = useRef(0);
  const previousArchiveProjectIdRef = useRef(archiveProjectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editHrefJoiner = useMemo(() => (editHrefBase.includes('?') ? '&' : '?'), [editHrefBase]);

  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('inbox');
  const boardFlowStatuses = useMemo(() => getBoardFlowStatuses(), []);
  const isBoardInteractionDisabled = isPending;
  const mobileStatuses = useMemo(
    () => getMobileBoardStatuses(columns, activeTab),
    [activeTab, columns],
  );
  const showHoldLane = shouldShowHoldLane(columns);
  const actionIslandControlSize = isMobile ? 42 : 'lg';
  const actionIslandPrimaryIconSize = isMobile ? 16 : 18;
  const actionIslandSecondaryIconSize = isMobile ? 14 : 16;
  const handleMobileRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  const readColumnsFromStore = useCallback(
    () => selectKanbanColumns(kanbanStore.getState()),
    [kanbanStore],
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 48em)');
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    return subscribeMediaQuery(mq, handler);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const body = (event.target as HTMLElement).closest(
        '.kanban-column-body',
      ) as HTMLElement | null;
      const action = resolveKanbanWheelAction({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        boardScrollLeft: el.scrollLeft,
        boardClientWidth: el.clientWidth,
        boardScrollWidth: el.scrollWidth,
        columnScrollTop: body?.scrollTop,
        columnClientHeight: body?.clientHeight,
        columnScrollHeight: body?.scrollHeight,
      });

      if (!action.preventDefault) {
        return;
      }

      event.preventDefault();
      el.scrollLeft = action.nextScrollLeft;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (
      !shouldApplyKanbanServerSnapshot({
        isPersisting: isPersistingRef.current,
        queuedCount: persistQueueRef.current.length,
      })
    ) {
      return;
    }

    const hydratedFocusedTask = resolveHydratedFocusedTask(
      kanbanStore.getState().focusedTask,
      selectedProject,
    );
    kanbanStore.getState().hydrate({
      columns: resolvedServerColumns,
      focusedTask: hydratedFocusedTask,
    });
    columnsRef.current = resolvedServerColumns;
    setSaveError(null);
  }, [kanbanStore, resolvedServerColumns, selectedProject]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    if (!isMobile) return;
    if (mobileStatuses.includes(activeTab as (typeof mobileStatuses)[number])) return;
    setActiveTab('todo');
  }, [activeTab, isMobile, mobileStatuses]);

  useEffect(() => {
    if (previousArchiveProjectIdRef.current === archiveProjectId) {
      return;
    }

    previousArchiveProjectIdRef.current = archiveProjectId;
    setArchiveQuery('');
    setArchivedDrawerState(buildInitialArchivedDrawerState(resolvedArchivedCount));
    setIsArchivedDrawerLoading(false);
    setIsArchivedDrawerLoadingMore(false);
    setArchiveLoadMoreError(null);
  }, [archiveProjectId, resolvedArchivedCount]);

  useEffect(() => {
    if (archiveQuery.trim()) {
      return;
    }

    setArchivedDrawerState((current) => ({
      ...current,
      total: resolvedArchivedCount,
      hasMore: current.nextOffset < resolvedArchivedCount,
    }));
  }, [archiveQuery, resolvedArchivedCount]);

  useEffect(() => {
    if (!archiveDrawerOpened) {
      return;
    }

    setArchiveLoadMoreError(null);
  }, [archiveDrawerOpened]);

  const applyOptimisticQueuedTask = useCallback(
    (taskKey: string, queuedAt: string) => {
      kanbanStore.getState().applyOptimisticRunState(taskKey, queuedAt);
      const nextColumns = readColumnsFromStore();
      columnsRef.current = nextColumns;
      setSaveError(null);

      const nextStatus = boardFlowStatuses.find((status) =>
        nextColumns[status].some((task) => task.taskKey === taskKey),
      );
      if (isMobile && nextStatus === 'todo') {
        setActiveTab('todo');
      }
    },
    [boardFlowStatuses, isMobile, kanbanStore, readColumnsFromStore],
  );

  async function persistUpdates(
    updates: Array<{ id: string; taskKey: string; status: KanbanStatus; sortOrder: string }>,
  ) {
    for (const update of updates) {
      let lastError = `Failed to update task order: ${update.taskKey}`;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`/api/todos/${encodeURIComponent(update.taskKey)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ status: update.status, sortOrder: update.sortOrder }),
        });
        if (response.ok) {
          lastError = '';
          break;
        }
        let detail = '';
        try {
          const payload = (await response.json()) as { error?: unknown };
          if (typeof payload.error === 'string') detail = payload.error;
        } catch {
          /* ignore */
        }
        lastError = detail
          ? `Failed to update task order (${response.status}): ${detail}`
          : `Failed to update task order (${response.status})`;
        if (response.status >= 500 && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 120));
          continue;
        }
        break;
      }
      if (lastError) throw new Error(lastError);
    }
  }

  async function persistMoveIntent(request: MoveIntentRequest) {
    const response = await requestMoveIntent(fetch, request);
    if (persistQueueRef.current.length > 1) {
      return;
    }

    const snapshots = buildMoveIntentServerSnapshots({
      columns: readColumnsFromStore(),
      response,
    });
    if (snapshots.length === 0) {
      return;
    }

    kanbanStore.getState().upsertSnapshots(snapshots);
    columnsRef.current = readColumnsFromStore();
  }

  const flushPersistQueue = useCallback(
    function flushPersistQueue() {
      if (isPersistingRef.current || persistQueueRef.current.length === 0) return;
      isPersistingRef.current = true;
      setKanbanReconciliationPaused(true);
      startTransition(() => {
        void (async () => {
          try {
            await drainKanbanMutationQueue(persistQueueRef.current);
          } catch (error) {
            persistQueueRef.current = [];
            console.error('[kanban] failed to persist queued mutation:', error);
            const msg =
              error instanceof Error ? error.message : 'Task order sync failed. Please try again.';
            setSaveError(msg);
            showErrorNotification(msg);
            if (shouldRefreshKanbanAfterPersist({ didFail: true, didRepairFail: true })) {
              router.refresh();
            }
          } finally {
            isPersistingRef.current = false;
            setKanbanReconciliationPaused(false);
            if (persistQueueRef.current.length > 0) {
              flushPersistQueue();
            }
          }
        })();
      });
    },
    [router, setKanbanReconciliationPaused, startTransition],
  );

  const enqueuePersist = useCallback(
    (mutation: QueuedKanbanMutation) => {
      persistQueueRef.current.push(mutation);
      flushPersistQueue();
    },
    [flushPersistQueue],
  );

  const loadArchivedTasks = useCallback(
    async (offset: number, append: boolean) => {
      const requestId = archiveRequestIdRef.current + 1;
      archiveRequestIdRef.current = requestId;
      if (append) {
        setIsArchivedDrawerLoadingMore(true);
      } else {
        setIsArchivedDrawerLoading(true);
      }

      try {
        const payload = await requestArchivedTasksPage({
          projectId: archiveProjectId,
          query: archiveQuery,
          limit: ARCHIVED_TASK_PAGE_SIZE,
          offset,
        });

        if (archiveRequestIdRef.current !== requestId) {
          return;
        }

        setArchivedDrawerState((current) => {
          const nextTasks = append
            ? [
                ...current.tasks,
                ...payload.tasks.filter(
                  (task) => !current.tasks.some((existing) => existing.id === task.id),
                ),
              ]
            : payload.tasks;

          return {
            tasks: nextTasks,
            total: payload.total,
            nextOffset: payload.offset + payload.tasks.length,
            hasMore: payload.hasMore,
          };
        });
        setArchiveLoadMoreError(null);
      } catch (error) {
        if (archiveRequestIdRef.current !== requestId) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to load archived tasks.';
        if (append) {
          setArchiveLoadMoreError(message);
        }
        showErrorNotification(message);
      } finally {
        if (archiveRequestIdRef.current === requestId) {
          setIsArchivedDrawerLoading(false);
          setIsArchivedDrawerLoadingMore(false);
        }
      }
    },
    [archiveProjectId, archiveQuery],
  );

  useEffect(() => {
    if (!archiveDrawerOpened) {
      return;
    }

    void loadArchivedTasks(0, false);
  }, [archiveDrawerOpened, archiveProjectId, archiveQuery, loadArchivedTasks]);

  const quickMoveTask = useCallback(
    (taskId: string, targetStatus: KanbanStatus) => {
      const previous = columnsRef.current;
      const changedTaskKeys = kanbanStore
        .getState()
        .applyMove(taskId, targetStatus, previous[targetStatus].length);
      if (changedTaskKeys.length === 0) return;

      const nextColumns = readColumnsFromStore();
      const movedTask = Object.values(nextColumns)
        .flat()
        .find((task) => task.id === taskId);
      if (!movedTask) return;

      const moveRequest = buildMoveIntentRequest({
        columns: nextColumns,
        taskKey: movedTask.taskKey,
        targetStatus,
      });
      columnsRef.current = nextColumns;
      setSaveError(null);
      if (!online && boardOfflineSync) {
        void boardOfflineSync.queueTaskMove({
          taskKey: movedTask.taskKey,
          status: targetStatus,
          sortOrder: movedTask.sortOrder,
        });
        return;
      }
      if (!moveRequest) return;

      enqueuePersist({
        run: async () => {
          try {
            await persistMoveIntent(moveRequest);
          } catch (error) {
            throw error instanceof Error ? error : new Error('Task move failed. Please try again.');
          }
        },
      });
    },
    [boardOfflineSync, enqueuePersist, kanbanStore, online, readColumnsFromStore],
  );

  const mobileQuickMove = useCallback(
    (taskId: string, targetStatus: KanbanStatus) => {
      quickMoveTask(taskId, targetStatus);
      setActiveTab(targetStatus);
    },
    [quickMoveTask],
  );

  const openTaskEditor = useCallback(
    (task: KanbanTask) => {
      openFocusedTaskFromBoardTask(task);
      onOpenTaskEditor?.(task);
    },
    [onOpenTaskEditor, openFocusedTaskFromBoardTask],
  );

  const updateTaskLabels = useCallback(
    async (taskKey: string, labelIds: string[]) => {
      const currentState = kanbanStore.getState();
      const didUpdate = await updateKanbanTaskLabelsFromBoard({
        taskKey,
        labelIds,
        currentFocusedTaskKey: currentState.focusedTaskKey,
        fetchImpl: fetch,
        upsertSnapshots: currentState.upsertSnapshots,
        setFocusedTask: currentState.setFocusedTask,
        setSaveError,
        notifyError: showErrorNotification,
      });

      if (didUpdate) {
        columnsRef.current = readColumnsFromStore();
      }
    },
    [kanbanStore, readColumnsFromStore],
  );

  const restoreArchivedTask = useCallback(
    (taskId: string, targetStatus: KanbanStatus) => {
      const archivedTask = archivedDrawerState.tasks.find((task) => task.id === taskId);
      if (!archivedTask) {
        quickMoveTask(taskId, targetStatus);
        return;
      }

      const targetColumn = columnsRef.current[targetStatus];
      const sortOrder = computeSortOrder(targetColumn, targetColumn.length);
      const restoredTask: KanbanTask = {
        ...archivedTask,
        status: targetStatus,
        sortOrder,
        archivedAt: null,
      };

      kanbanStore.getState().upsertSnapshots([restoredTask]);
      const nextColumns = readColumnsFromStore();
      columnsRef.current = nextColumns;
      setSaveError(null);
      setArchivedDrawerState((current) => removeArchivedDrawerTaskState(current, taskId));
      onArchivedCountChange?.((current) => Math.max(0, current - 1));

      if (isMobile && targetStatus === 'todo') {
        setActiveTab('todo');
      }

      const moveRequest = buildMoveIntentRequest({
        columns: nextColumns,
        taskKey: archivedTask.taskKey,
        targetStatus,
      });
      if (!online && boardOfflineSync) {
        void boardOfflineSync.queueTaskMove({
          taskKey: archivedTask.taskKey,
          status: targetStatus,
          sortOrder,
        });
        return;
      }
      if (!moveRequest) return;

      enqueuePersist({
        run: async () => {
          await persistMoveIntent(moveRequest);
        },
      });
    },
    [
      archivedDrawerState.tasks,
      boardOfflineSync,
      enqueuePersist,
      isMobile,
      kanbanStore,
      online,
      onArchivedCountChange,
      quickMoveTask,
      readColumnsFromStore,
    ],
  );

  const requestDeleteTask = useCallback(
    (taskId: string) => {
      const located = findTaskLocation(columnsRef.current, taskId);
      if (located) {
        const task = columnsRef.current[located.status][located.index];
        if (!task) return;
        setDeleteConfirm({ taskId: task.id, taskKey: task.taskKey, title: task.title });
        return;
      }

      const archivedTask = archivedDrawerState.tasks.find((task) => task.id === taskId);
      if (!archivedTask) return;
      setDeleteConfirm({
        taskId: archivedTask.id,
        taskKey: archivedTask.taskKey,
        title: archivedTask.title,
      });
    },
    [archivedDrawerState.tasks],
  );

  const deleteTask = useCallback(
    (taskId: string) => {
      const previous = columnsRef.current;
      const located = findTaskLocation(previous, taskId);
      if (located) {
        const targetTask = previous[located.status][located.index];
        if (!targetTask) return;

        kanbanStore.getState().removeTask(targetTask.taskKey);
        const nextColumns = readColumnsFromStore();
        const updates = buildUpdates(previous, nextColumns);
        columnsRef.current = nextColumns;
        setSaveError(null);

        if (located.status === 'archived') {
          setArchivedDrawerState((current) => removeArchivedDrawerTaskState(current, taskId));
          onArchivedCountChange?.((current) => Math.max(0, current - 1));
        }

        enqueuePersist({
          run: async () => {
            const response = await fetch(`/api/todos/${encodeURIComponent(targetTask.taskKey)}`, {
              method: 'DELETE',
              credentials: 'same-origin',
            });
            if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
            if (updates.length > 0) await persistUpdates(updates);
          },
        });
        return;
      }

      const archivedTask = archivedDrawerState.tasks.find((task) => task.id === taskId);
      if (!archivedTask) return;

      kanbanStore.getState().removeTask(archivedTask.taskKey);
      columnsRef.current = readColumnsFromStore();
      setSaveError(null);
      setArchivedDrawerState((current) => removeArchivedDrawerTaskState(current, taskId));
      onArchivedCountChange?.((current) => Math.max(0, current - 1));

      enqueuePersist({
        run: async () => {
          const response = await fetch(`/api/todos/${encodeURIComponent(archivedTask.taskKey)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });
          if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
        },
      });
    },
    [
      archivedDrawerState.tasks,
      enqueuePersist,
      kanbanStore,
      onArchivedCountChange,
      readColumnsFromStore,
    ],
  );

  async function handleArchiveAllDone() {
    const doneCount = columnsRef.current.done.length;
    if (doneCount === 0) return;
    try {
      const response = await fetch('/api/todos/archive-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject?.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        count?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        const message = payload?.error || 'Failed to archive Done tasks';
        setSaveError(message);
        showErrorNotification(message);
        return;
      }

      const archivedCountDelta = payload?.count ?? doneCount;
      kanbanStore.getState().hydrate({
        columns: { ...columnsRef.current, done: [] },
        focusedTask: kanbanStore.getState().focusedTask,
      });
      columnsRef.current = readColumnsFromStore();
      setSaveError(null);
      onArchivedCountChange?.((current) => current + archivedCountDelta);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to archive Done tasks';
      setSaveError(message);
      showErrorNotification(message);
    }
  }

  const readyBatchInFlightRef = useRef(false);

  const handleMoveAllReadyToDone = useCallback(async () => {
    if (!selectedProject) return false;
    if (readyBatchInFlightRef.current || columnsRef.current.ready.length === 0) {
      return false;
    }

    readyBatchInFlightRef.current = true;

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(selectedProject.id)}/ready/complete`,
        {
          method: 'POST',
          credentials: 'same-origin',
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        movedTasks?: KanbanTask[];
        error?: string;
      } | null;

      if (!response.ok) {
        const message = payload?.error || 'Failed to move Ready tasks';
        setSaveError(message);
        showErrorNotification(message);
        return false;
      }

      if (!payload || !Array.isArray(payload.movedTasks)) {
        const message = 'Failed to reconcile moved Ready tasks.';
        setSaveError(message);
        showErrorNotification(message);
        router.refresh();
        return false;
      }

      kanbanStore.getState().upsertSnapshots(payload.movedTasks);
      columnsRef.current = readColumnsFromStore();
      setSaveError(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to move Ready tasks';
      setSaveError(message);
      showErrorNotification(message);
      router.refresh();
      return false;
    } finally {
      readyBatchInFlightRef.current = false;
    }
  }, [kanbanStore, readColumnsFromStore, router, selectedProject]);

  function renderColumnBatchMenu(params: {
    ariaLabel: string;
    itemLabel: string;
    disabled: boolean;
    onAction: () => void;
  }) {
    return (
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            className="kanban-column-action-trigger"
            aria-label={params.ariaLabel}
            disabled={params.disabled}
          >
            <IconChevronDown size={18} stroke={2.4} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item disabled={params.disabled} onClick={params.onAction}>
            {params.itemLabel}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }

  function handleDragEnd(result: DropResult) {
    if (isBoardInteractionDisabled) return;
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const previous = columnsRef.current;
    const sourceStatus = source.droppableId as KanbanStatus;
    const destStatus = destination.droppableId as KanbanStatus;
    const movedTask = previous[sourceStatus][source.index];
    if (!movedTask) return;

    const changedTaskKeys = kanbanStore
      .getState()
      .applyMove(movedTask.id, destStatus, destination.index);
    if (changedTaskKeys.length === 0) return;

    const nextColumns = readColumnsFromStore();
    const moveRequest = buildMoveIntentRequest({
      columns: nextColumns,
      taskKey: movedTask.taskKey,
      targetStatus: destStatus,
    });

    columnsRef.current = nextColumns;
    setSaveError(null);
    if (!online && boardOfflineSync) {
      void boardOfflineSync.queueTaskMove({
        taskKey: movedTask.taskKey,
        status: destStatus,
        sortOrder: nextColumns[destStatus][destination.index]?.sortOrder ?? movedTask.sortOrder,
      });
      return;
    }
    if (!moveRequest) return;

    enqueuePersist({
      run: async () => {
        try {
          await persistMoveIntent(moveRequest);
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error('Task order sync failed. Please try again.');
        }
      },
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board-region">
        {isMobile ? (
          <KanbanBoardMobile
            columns={columns}
            activeTab={activeTab}
            onTabChange={(value) => setActiveTab(value)}
            isPending={isBoardInteractionDisabled}
            editHrefBase={editHrefBase}
            editHrefJoiner={editHrefJoiner}
            telegramEnabled={telegramEnabled}
            router={router}
            onRefresh={handleMobileRefresh}
            onTaskQueued={applyOptimisticQueuedTask}
            onQuickMoveTask={mobileQuickMove}
            onDeleteTask={requestDeleteTask}
            labelOptions={labelOptions}
            onUpdateTaskLabels={updateTaskLabels}
            saveError={saveError}
            enginePresets={enginePresets}
            onOpenTaskEditor={openTaskEditor}
          />
        ) : (
          <div className="kanban-scroll kanban-fullscreen" ref={scrollRef}>
            <div className={`kanban-board-shell${showHoldLane ? ' has-hold-rail' : ''}`}>
              <div className="kanban-grid">
                {boardFlowStatuses.map((status) => {
                  const headerActions =
                    status === 'ready'
                      ? selectedProject && columns.ready.length > 0
                        ? renderColumnBatchMenu({
                            ariaLabel: `Ready actions for ${columns.ready.length} tasks`,
                            itemLabel: 'Move all to Done',
                            disabled: isBoardInteractionDisabled,
                            onAction: () => {
                              void handleMoveAllReadyToDone();
                            },
                          })
                        : undefined
                      : status === 'done' && columns.done.length > 0
                        ? renderColumnBatchMenu({
                            ariaLabel: `Done actions for ${columns.done.length} tasks`,
                            itemLabel: 'Move all to Archived',
                            disabled: isBoardInteractionDisabled,
                            onAction: () => {
                              void handleArchiveAllDone();
                            },
                          })
                        : undefined;

                  return (
                    <KanbanColumn
                      key={status}
                      status={status}
                      statusLabel={boardStatusLabel(status, terminology)}
                      tasks={columns[status]}
                      isPending={isBoardInteractionDisabled}
                      isMobile={isMobile}
                      editHrefBase={editHrefBase}
                      editHrefJoiner={editHrefJoiner}
                      telegramEnabled={telegramEnabled}
                      router={router}
                      onTaskQueued={applyOptimisticQueuedTask}
                      onQuickMoveTask={quickMoveTask}
                      onDeleteTask={requestDeleteTask}
                      labelOptions={labelOptions}
                      onUpdateTaskLabels={updateTaskLabels}
                      enginePresets={enginePresets}
                      onOpenTaskEditor={openTaskEditor}
                      headerActions={headerActions}
                    />
                  );
                })}
              </div>
              {showHoldLane ? (
                <div className="kanban-hold-rail kanban-hold-rail--compact kanban-hold-rail--fixed-width">
                  <KanbanColumn
                    status="hold"
                    statusLabel={boardStatusLabel('hold', terminology)}
                    tasks={columns.hold}
                    isPending={isBoardInteractionDisabled}
                    isMobile={isMobile}
                    editHrefBase={editHrefBase}
                    editHrefJoiner={editHrefJoiner}
                    telegramEnabled={telegramEnabled}
                    router={router}
                    onTaskQueued={applyOptimisticQueuedTask}
                    onQuickMoveTask={quickMoveTask}
                    onDeleteTask={requestDeleteTask}
                    labelOptions={labelOptions}
                    onUpdateTaskLabels={updateTaskLabels}
                    enginePresets={enginePresets}
                    className="kanban-column--hold-rail"
                    onOpenTaskEditor={openTaskEditor}
                  />
                </div>
              ) : null}
            </div>
            {saveError ? (
              <Text c="red" size="sm" mt="sm">
                {saveError}
              </Text>
            ) : null}
          </div>
        )}

        <div className="kanban-action-island-anchor">
          <div className="kanban-action-island">
            <Tooltip label={`New ${terminology.task.singular}`}>
              <ActionIcon
                size={actionIslandControlSize}
                radius="xl"
                variant="filled"
                color="blue"
                aria-label={`Add ${terminology.task.singularLower}`}
                onClick={() => setQuickAddOpened(true)}
              >
                <IconPlus size={actionIslandPrimaryIconSize} />
              </ActionIcon>
            </Tooltip>

            {readyQaConfig ? (
              <ReadyQaActions
                projectId={readyQaConfig.projectId}
                projectKey={readyQaConfig.projectKey}
                projectName={readyQaConfig.projectName}
                branchName={readyQaConfig.branchName}
                readyCount={columns.ready.length}
                telegramEnabled={telegramEnabled}
                initialRuns={readyQaConfig.runs}
                defaultEngine={enginePresets?.defaultEngine}
                size={actionIslandControlSize}
                iconSize={actionIslandSecondaryIconSize}
              />
            ) : null}

            {selectedProject ? (
              <Tooltip label="Insight">
                <ActionIcon
                  size={actionIslandControlSize}
                  radius="xl"
                  variant="default"
                  aria-label="Open project insight"
                  onClick={() => setInsightOpened(true)}
                >
                  <IconBulb size={actionIslandSecondaryIconSize} />
                </ActionIcon>
              </Tooltip>
            ) : null}

            <div className="kanban-action-island-divider" />

            {selectedProject ? (
              <Tooltip label="Settings">
                <ActionIcon
                  component={Link}
                  href={`/project/${selectedProject.projectKey}`}
                  size={actionIslandControlSize}
                  radius="xl"
                  variant="default"
                  aria-label="Open project settings"
                >
                  <IconSettings size={actionIslandSecondaryIconSize} />
                </ActionIcon>
              </Tooltip>
            ) : null}

            <Tooltip label={`Archived ${terminology.task.pluralLower}`}>
              <div className="kanban-action-island-archive">
                <ActionIcon
                  size={actionIslandControlSize}
                  radius="xl"
                  variant="default"
                  aria-label={`Open archived ${terminology.task.pluralLower}`}
                  onClick={() => {
                    setArchiveLoadMoreError(null);
                    setArchiveDrawerOpened(true);
                  }}
                >
                  <IconArchive size={actionIslandSecondaryIconSize} />
                </ActionIcon>
                {resolvedArchivedCount > 0 ? (
                  <span className="kanban-action-island-badge">{resolvedArchivedCount}</span>
                ) : null}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>

      <Modal
        opened={quickAddOpened}
        onClose={() => setQuickAddOpened(false)}
        title={`Add ${terminology.task.singular}`}
        closeButtonProps={{ 'aria-label': `Close Add ${terminology.task.singular} dialog` }}
        centered
        size="sm"
      >
        <KanbanQuickAdd
          selectedProject={selectedProject}
          projectOptions={projectOptions}
          projectLabelOptionsByProjectId={projectLabelOptionsByProjectId}
          editHrefBase={editHrefBase}
          editHrefJoiner={editHrefJoiner}
          onClose={() => setQuickAddOpened(false)}
          onTaskCreated={(task) => {
            kanbanStore.getState().upsertSnapshots([task]);
          }}
        />
      </Modal>

      <ProjectInsightModal
        opened={insightOpened}
        onClose={() => setInsightOpened(false)}
        selectedProject={selectedProject}
        telegramEnabled={telegramEnabled}
        defaultEngine={enginePresets?.defaultEngine ?? 'codex'}
      />

      <KanbanArchiveDrawer
        opened={archiveDrawerOpened}
        onClose={() => {
          setArchiveDrawerOpened(false);
          setArchiveQuery('');
          setArchiveLoadMoreError(null);
        }}
        tasks={archivedDrawerState.tasks}
        total={archivedDrawerState.total}
        query={archiveQuery}
        isLoading={isArchivedDrawerLoading}
        isLoadingMore={isArchivedDrawerLoadingMore}
        hasMore={archivedDrawerState.hasMore}
        nextOffset={archivedDrawerState.nextOffset}
        loadMoreError={archiveLoadMoreError}
        isPending={isPending}
        onQueryChange={(value) => {
          setArchiveLoadMoreError(null);
          setArchiveQuery(value);
        }}
        onRestore={restoreArchivedTask}
        onDelete={requestDeleteTask}
        onLoadMore={() => {
          if (isArchivedDrawerLoading || isArchivedDrawerLoadingMore) {
            return;
          }
          void loadArchivedTasks(archivedDrawerState.nextOffset, true);
        }}
      />

      <Modal
        opened={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title={`Delete ${terminology.task.singularLower}`}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <strong>{deleteConfirm?.taskKey}</strong> &quot;
            {deleteConfirm?.title}&quot;? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (deleteConfirm) {
                  deleteTask(deleteConfirm.taskId);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </DragDropContext>
  );
}
