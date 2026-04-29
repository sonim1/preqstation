import { and, asc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { writeAuditLog } from '@/lib/audit';
import {
  TODO_NOTE_MAX_LENGTH,
  TODO_SORT_ORDER_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from '@/lib/content-limits';
import { withOwnerDb } from '@/lib/db/rls';
import { projects, taskLabelAssignments, tasks, workLogs } from '@/lib/db/schema';
import { serializeEditableBoardTask } from '@/lib/editable-board-task';
import type { EditableBoardTask } from '@/lib/kanban-store';
import {
  ENTITY_TASK,
  TASK_DELETED,
  TASK_UPDATED,
  writeOutboxEvent,
  writeOutboxEventStandalone,
} from '@/lib/outbox';
import { requireOwnerUser } from '@/lib/owner';
import { assertSameOrigin } from '@/lib/request-security';
import { normalizeTaskDispatchTarget } from '@/lib/task-dispatch';
import { isTaskKeyUniqueConstraintError, taskWhereByIdentifier } from '@/lib/task-keys';
import {
  extractTaskLabels,
  normalizeTaskLabelIds,
  resolveProjectTaskLabels,
  summarizeTaskLabelNames,
  syncTaskLabelAssignments,
} from '@/lib/task-labels';
import {
  coerceTaskRunState,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskStatus,
} from '@/lib/task-meta';
import { buildTaskNoteFingerprint } from '@/lib/task-note-fingerprint';
import { safeCreateTaskCompletionNotification } from '@/lib/task-notifications';
import { buildTaskRunStateUpdate } from '@/lib/task-run-state';
import {
  repairLaneIfNeeded,
  resolveRequestedTaskSortOrder,
  type TaskSortOrderClient,
} from '@/lib/task-sort-order';
import { applyBoardTaskStatusTransition } from '@/lib/task-status-transition';
import {
  addTaskFieldChange,
  buildTaskFieldChangeWorkLog,
  type TaskFieldChange,
  taskPriorityLabel,
} from '@/lib/task-worklog';

const updateTaskSchema = z.object({
  baseNoteFingerprint: z.string().trim().optional().or(z.literal('')),
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH).optional(),
  note: z.string().trim().max(TODO_NOTE_MAX_LENGTH).optional().or(z.literal('')),
  status: z.enum(TASK_STATUSES).optional(),
  projectId: z.string().uuid().optional().or(z.literal('')),
  labelIds: z.array(z.string().uuid()).optional(),
  dueAt: z.string().datetime().optional().or(z.literal('')),
  focusedAt: z.string().datetime().optional().nullable().or(z.literal('')),
  sortOrder: z.string().max(TODO_SORT_ORDER_MAX_LENGTH).optional(),
  taskPriority: z.enum(TASK_PRIORITIES).optional(),
});

function isTransientError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /connection|closed|timeout|econnreset|terminating connection/i.test(message);
}

function isTaskPriorityConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return (
    /tasks_priority_check|priority/i.test(message) && /constraint|range|violates/i.test(message)
  );
}

function isTaskStatusConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /tasks_status_check|status/i.test(message) && /constraint|range|violates/i.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolvePatchedTaskPlacement(params: {
  client: TaskSortOrderClient;
  ownerId: string;
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  requestedSortOrder: string | null | undefined;
}) {
  const placement = await resolveRequestedTaskSortOrder({
    client: params.client,
    ownerId: params.ownerId,
    status: params.toStatus,
    requestedSortOrder: params.requestedSortOrder,
    excludeTaskId: params.taskId,
  });

  if (params.fromStatus !== params.toStatus) {
    await repairLaneIfNeeded({
      client: params.client,
      ownerId: params.ownerId,
      status: params.fromStatus,
      excludeTaskId: params.taskId,
    });
  }

  return placement;
}

function toEditableTodo(task: {
  id: string;
  taskKey: string;
  title: string;
  branch: string | null;
  note: string | null;
  projectId: string | null;
  taskPriority: string;
  status: string;
  engine: string | null;
  dispatchTarget: string | null;
  runState: string | null;
  runStateUpdatedAt: Date | null;
  label?: { id: string; name: string; color: string | null } | null;
  labelAssignments?: Array<{
    position?: number;
    label?: { id: string; name: string; color: string | null } | null;
  }>;
  workLogs?: Array<{
    id: string;
    title: string;
    detail?: string | null;
    engine: string | null;
    workedAt: Date;
    createdAt: Date;
    task?: { engine: string | null } | null;
  }>;
}): EditableBoardTask {
  const labels = extractTaskLabels(task);

  return {
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    branch: task.branch,
    note: task.note,
    projectId: task.projectId,
    labelIds: labels.map((label) => label.id),
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
    })),
    taskPriority: task.taskPriority,
    status: task.status,
    engine: task.engine,
    dispatchTarget: normalizeTaskDispatchTarget(task.dispatchTarget),
    runState: coerceTaskRunState(task.runState),
    runStateUpdatedAt: task.runStateUpdatedAt ? task.runStateUpdatedAt.toISOString() : null,
    workLogs:
      task.workLogs?.map((log) => ({
        id: log.id,
        title: log.title,
        engine: log.engine,
        workedAt: log.workedAt,
        createdAt: log.createdAt,
        todo: log.task ? { engine: log.task.engine } : null,
      })) ?? [],
  };
}

function serializePatchFocusedTask(task: EditableBoardTask) {
  return serializeEditableBoardTask(task);
}

function toPatchedBoardTask(params: {
  existing: {
    id: string;
    taskKey: string;
    branch: string | null;
    projectId: string | null;
    engine: string | null;
  };
  title: string;
  note: string | null;
  status: string;
  sortOrder: string;
  taskPriority: string;
  dueAt: Date | null;
  project: {
    id: string;
    name: string;
    projectKey: string | null;
  } | null;
  labels: Array<{ id: string; name: string; color?: string | null }>;
}) {
  return {
    id: params.existing.id,
    taskKey: params.existing.taskKey,
    branch: params.existing.branch,
    title: params.title,
    note: params.note,
    status: params.status,
    sortOrder: params.sortOrder,
    taskPriority: params.taskPriority,
    dueAt: params.dueAt ? params.dueAt.toISOString() : null,
    engine: params.existing.engine ?? null,
    runState: null,
    runStateUpdatedAt: null,
    project: params.project?.projectKey
      ? {
          id: params.project.id,
          name: params.project.name,
          projectKey: params.project.projectKey,
        }
      : null,
    updatedAt: new Date().toISOString(),
    archivedAt: params.status === 'archived' ? new Date().toISOString() : null,
    labels: params.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? 'blue',
    })),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwnerUser();
    const { id: identifier } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const todo = await client.query.tasks.findFirst({
        where: taskWhereByIdentifier(owner.id, identifier),
        columns: {
          id: true,
          taskKey: true,
          title: true,
          branch: true,
          note: true,
          projectId: true,
          taskPriority: true,
          status: true,
          engine: true,
          dispatchTarget: true,
          runState: true,
          runStateUpdatedAt: true,
        },
        with: {
          labelAssignments: {
            columns: { position: true },
            orderBy: [asc(taskLabelAssignments.position)],
            with: {
              label: { columns: { id: true, name: true, color: true } },
            },
          },
          label: { columns: { id: true, name: true, color: true } },
          workLogs: {
            orderBy: [asc(workLogs.workedAt)],
            columns: {
              id: true,
              title: true,
              engine: true,
              workedAt: true,
              createdAt: true,
            },
            with: {
              task: { columns: { engine: true } },
            },
          },
        },
      });

      if (!todo) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({ todo: serializeEditableBoardTask(toEditableTodo(todo)) });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to load todo' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id: identifier } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if ('taskKey' in body || 'taskPrefix' in body || 'taskNumber' in body) {
      return NextResponse.json(
        { error: 'Task ID is auto-generated and cannot be edited.' },
        { status: 400 },
      );
    }
    if ('labelId' in body) {
      return NextResponse.json(
        { error: 'labelId is no longer supported. Use labelIds.' },
        { status: 400 },
      );
    }
    const payload = updateTaskSchema.parse(body);

    const runPatchAttempt = async () =>
      withOwnerDb(owner.id, async (client) => {
        const existing = await client.query.tasks.findFirst({
          where: taskWhereByIdentifier(owner.id, identifier),
          columns: {
            id: true,
            taskKey: true,
            title: true,
            branch: true,
            note: true,
            engine: true,
            status: true,
            sortOrder: true,
            taskPriority: true,
            projectId: true,
            dispatchTarget: true,
            runState: true,
            runStateUpdatedAt: true,
            labelId: true,
            dueAt: true,
            focusedAt: true,
            archivedAt: true,
            updatedAt: true,
          },
          with: {
            project: { columns: { id: true, name: true, projectKey: true } },
            label: { columns: { id: true, name: true, color: true } },
            labelAssignments: {
              columns: { position: true },
              orderBy: [asc(taskLabelAssignments.position)],
              with: {
                label: { columns: { id: true, name: true, color: true } },
              },
            },
            workLogs: {
              orderBy: [asc(workLogs.workedAt)],
              columns: {
                id: true,
                title: true,
                engine: true,
                workedAt: true,
                createdAt: true,
              },
              with: {
                task: { columns: { engine: true } },
              },
            },
          },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (
          payload.projectId !== undefined &&
          payload.projectId !== existing.projectId &&
          payload.projectId !== ''
        ) {
          const project = await client.query.projects.findFirst({
            where: and(
              eq(projects.id, payload.projectId),
              eq(projects.ownerId, owner.id),
              isNull(projects.deletedAt),
            ),
            columns: { id: true },
          });
          if (!project) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
          }
          return NextResponse.json(
            { error: 'Project changes are not supported.' },
            { status: 400 },
          );
        }
        if (payload.projectId === '') {
          return NextResponse.json(
            { error: 'Project changes are not supported.' },
            { status: 400 },
          );
        }

        const nextProjectId = existing.projectId;
        const nextProjectName = existing.project?.name || 'No project';
        const nextProjectKey = existing.project?.projectKey ?? null;

        const existingLabels = extractTaskLabels(existing);
        const requestedLabelIds =
          payload.labelIds !== undefined ? normalizeTaskLabelIds(payload.labelIds) : undefined;
        const resolvedLabels =
          requestedLabelIds === undefined
            ? existingLabels
            : await resolveProjectTaskLabels(
                owner.id,
                existing.projectId,
                requestedLabelIds,
                client,
              );
        if (requestedLabelIds && resolvedLabels.length !== requestedLabelIds.length) {
          return NextResponse.json(
            { error: requestedLabelIds.length > 1 ? 'Invalid labelIds' : 'Invalid labelId' },
            { status: 400 },
          );
        }

        const nextTitle = payload.title !== undefined ? payload.title : existing.title;
        let nextNote =
          payload.note !== undefined
            ? payload.note === ''
              ? null
              : payload.note
            : (existing.note ?? null);
        const nextTaskPriority =
          payload.taskPriority !== undefined ? payload.taskPriority : existing.taskPriority;
        const nextDueAt =
          payload.dueAt === undefined
            ? existing.dueAt
            : payload.dueAt === ''
              ? null
              : new Date(payload.dueAt);
        const baseNoteFingerprint = payload.baseNoteFingerprint?.trim() || null;

        if (payload.note !== undefined) {
          const existingNoteFingerprint = buildTaskNoteFingerprint(existing.note);
          const submittedNoteFingerprint = buildTaskNoteFingerprint(nextNote);

          if (baseNoteFingerprint && baseNoteFingerprint !== existingNoteFingerprint) {
            if (submittedNoteFingerprint === baseNoteFingerprint) {
              nextNote = existing.note ?? null;
            } else {
              return NextResponse.json(
                {
                  error:
                    'Task notes changed in another session. Reload the latest notes and try again.',
                  boardTask: toPatchedBoardTask({
                    existing,
                    title: existing.title,
                    note: existing.note ?? null,
                    status: existing.status,
                    sortOrder: existing.sortOrder,
                    taskPriority: existing.taskPriority,
                    dueAt: existing.dueAt,
                    project: nextProjectId
                      ? {
                          id: nextProjectId,
                          name: nextProjectName,
                          projectKey: nextProjectKey,
                        }
                      : null,
                    labels: existingLabels,
                  }),
                  focusedTask: serializePatchFocusedTask(
                    toEditableTodo({
                      ...existing,
                      labelAssignments: existingLabels.map((label, index) => ({
                        position: index,
                        label: { id: label.id, name: label.name, color: label.color ?? null },
                      })),
                      label: existingLabels[0]
                        ? {
                            id: existingLabels[0].id,
                            name: existingLabels[0].name,
                            color: existingLabels[0].color ?? null,
                          }
                        : null,
                      note: existing.note ?? null,
                      workLogs: existing.workLogs ?? [],
                    }),
                  ),
                },
                { status: 409 },
              );
            }
          }
        }

        const fieldChanges: TaskFieldChange[] = [];
        addTaskFieldChange(fieldChanges, 'Title', existing.title, nextTitle);
        addTaskFieldChange(
          fieldChanges,
          'Priority',
          taskPriorityLabel(existing.taskPriority),
          taskPriorityLabel(nextTaskPriority),
        );
        addTaskFieldChange(
          fieldChanges,
          'Labels',
          summarizeTaskLabelNames(existingLabels),
          summarizeTaskLabelNames(resolvedLabels),
        );
        addTaskFieldChange(fieldChanges, 'Due Date', existing.dueAt, nextDueAt);

        const nextStatus = (
          payload.status !== undefined ? payload.status : existing.status
        ) as (typeof TASK_STATUSES)[number];
        const statusChanged = existing.status !== nextStatus;
        const wantsLanePlacement = payload.sortOrder !== undefined || payload.status !== undefined;
        let nextSortOrder = payload.sortOrder ?? existing.sortOrder;
        if (wantsLanePlacement) {
          const requestedSortOrder =
            existing.status === 'archived' && nextStatus !== existing.status
              ? null
              : (payload.sortOrder ?? existing.sortOrder);
          const placement = await resolvePatchedTaskPlacement({
            client,
            ownerId: owner.id,
            taskId: existing.id,
            fromStatus: existing.status as TaskStatus,
            toStatus: nextStatus as TaskStatus,
            requestedSortOrder,
          });
          nextSortOrder = placement.sortOrder;
        }
        const logProjectId = existing.projectId;
        if (statusChanged) {
          const movedTask = await applyBoardTaskStatusTransition({
            tx: client,
            ownerId: owner.id,
            projectId: logProjectId,
            existingTask: existing,
            nextTask: {
              title: nextTitle,
              note: nextNote,
              status: nextStatus,
              sortOrder: nextSortOrder,
              taskPriority: nextTaskPriority,
              dueAt: nextDueAt,
              labelId: resolvedLabels[0]?.id ?? null,
              labels: resolvedLabels,
            },
            extraChanges: fieldChanges,
          });

          if (requestedLabelIds !== undefined) {
            await syncTaskLabelAssignments(
              client,
              existing.id,
              resolvedLabels.map((label) => label.id),
            );
          }

          await writeAuditLog(
            {
              ownerId: owner.id,
              action: 'task.updated',
              targetType: 'task',
              targetId: existing.taskKey,
              meta: {
                fromStatus: existing.status,
                status: nextStatus,
                changedFields: fieldChanges.map((change) => change.field),
              },
            },
            client,
          );

          return NextResponse.json({
            ok: true,
            boardTask: movedTask,
            focusedTask: serializePatchFocusedTask(
              toEditableTodo({
                ...existing,
                title: nextTitle,
                note: nextNote,
                projectId: existing.projectId,
                taskPriority: nextTaskPriority,
                status: nextStatus,
                engine: null,
                runState: null,
                runStateUpdatedAt: null,
                labelAssignments: resolvedLabels.map((label, index) => ({
                  position: index,
                  label: { id: label.id, name: label.name, color: label.color ?? null },
                })),
                label: resolvedLabels[0]
                  ? {
                      id: resolvedLabels[0].id,
                      name: resolvedLabels[0].name,
                      color: resolvedLabels[0].color ?? null,
                    }
                  : null,
                workLogs: existing.workLogs ?? [],
              }),
            ),
          });
        }

        const data: Record<string, unknown> = {};
        if (payload.title !== undefined) data.title = payload.title;
        if (payload.note !== undefined) data.note = nextNote;
        if (payload.status !== undefined) {
          data.status = payload.status;
          Object.assign(data, buildTaskRunStateUpdate(null));
          if (payload.status === 'archived') {
            data.archivedAt = new Date();
          } else if (existing.status === 'archived') {
            data.archivedAt = null;
          }
        }
        if (requestedLabelIds !== undefined) data.labelId = resolvedLabels[0]?.id ?? null;
        if (payload.dueAt !== undefined)
          data.dueAt =
            payload.dueAt === '' ? null : payload.dueAt ? new Date(payload.dueAt) : undefined;
        if (payload.focusedAt !== undefined)
          data.focusedAt =
            payload.focusedAt === '' || payload.focusedAt === null
              ? null
              : new Date(payload.focusedAt);
        if (payload.taskPriority !== undefined) data.taskPriority = payload.taskPriority;

        if (wantsLanePlacement) {
          data.sortOrder = nextSortOrder;
        }

        const shouldResetEngine =
          payload.title !== undefined ||
          payload.note !== undefined ||
          payload.status !== undefined ||
          payload.labelIds !== undefined ||
          payload.dueAt !== undefined ||
          payload.focusedAt !== undefined ||
          payload.taskPriority !== undefined;
        if (shouldResetEngine) data.engine = null;

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ ok: true });
        }

        const updatedRows = await client
          .update(tasks)
          .set(data)
          .where(taskWhereByIdentifier(owner.id, identifier))
          .returning({ id: tasks.id });

        if (updatedRows.length > 0 && requestedLabelIds !== undefined) {
          await syncTaskLabelAssignments(
            client,
            existing.id,
            resolvedLabels.map((label) => label.id),
          );
        }

        if (updatedRows.length === 0) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const fieldLog = buildTaskFieldChangeWorkLog({
          taskKey: existing.taskKey,
          taskTitle: nextTitle,
          changes: fieldChanges,
        });
        if (fieldLog) {
          await client.insert(workLogs).values({
            ownerId: owner.id,
            projectId: logProjectId,
            taskId: existing.id,
            title: fieldLog.title,
            detail: fieldLog.detail,
            engine: null,
            workedAt: new Date(),
          });
        }

        await safeCreateTaskCompletionNotification({
          tx: client,
          ownerId: owner.id,
          projectId: logProjectId,
          taskId: existing.id,
          taskKey: existing.taskKey,
          taskTitle: nextTitle,
          fromStatus: existing.status,
          toStatus: nextStatus,
          previousRunState: existing.runState,
          nextRunState: payload.status !== undefined ? null : (existing.runState ?? null),
        });

        await writeAuditLog(
          {
            ownerId: owner.id,
            action: 'task.updated',
            targetType: 'task',
            targetId: existing.taskKey,
            meta: {
              fromStatus: existing.status,
              status: nextStatus,
              changedFields: fieldChanges.map((change) => change.field),
            },
          },
          client,
        );

        await writeOutboxEventStandalone(
          {
            ownerId: owner.id,
            projectId: logProjectId,
            eventType: TASK_UPDATED,
            entityType: ENTITY_TASK,
            entityId: existing.taskKey,
            payload: { changedFields: fieldChanges.map((c) => c.field) },
          },
          client,
        );

        return NextResponse.json({
          ok: true,
          boardTask: toPatchedBoardTask({
            existing,
            title: nextTitle,
            note: nextNote,
            status: nextStatus,
            sortOrder: typeof data.sortOrder === 'string' ? data.sortOrder : existing.sortOrder,
            taskPriority: nextTaskPriority,
            dueAt: nextDueAt,
            project: nextProjectId
              ? {
                  id: nextProjectId,
                  name: nextProjectName,
                  projectKey: nextProjectKey,
                }
              : null,
            labels: resolvedLabels,
          }),
          focusedTask: serializePatchFocusedTask(
            toEditableTodo({
              ...existing,
              title: nextTitle,
              note: nextNote,
              projectId: existing.projectId,
              taskPriority: nextTaskPriority,
              status: nextStatus,
              engine: null,
              runState: null,
              runStateUpdatedAt: null,
              labelAssignments: resolvedLabels.map((label, index) => ({
                position: index,
                label: { id: label.id, name: label.name, color: label.color ?? null },
              })),
              label: resolvedLabels[0]
                ? {
                    id: resolvedLabels[0].id,
                    name: resolvedLabels[0].name,
                    color: resolvedLabels[0].color ?? null,
                  }
                : null,
              workLogs: existing.workLogs ?? [],
            }),
          ),
        });
      });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await runPatchAttempt();
      } catch (error) {
        if (isTransientError(error) && attempt === 0) {
          await delay(120);
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }
    if (isTaskKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'Task ID already exists. Choose another ID.' },
        { status: 409 },
      );
    }
    if (isTaskStatusConstraintError(error)) {
      return NextResponse.json(
        {
          error: 'Task status is out of range in database. Run latest migrations.',
        },
        { status: 409 },
      );
    }
    if (isTaskPriorityConstraintError(error)) {
      return NextResponse.json(
        {
          error: 'Task priority is out of range in database. Run latest migrations.',
        },
        { status: 409 },
      );
    }
    console.error('[todos.patch] failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to update task';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to update task' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = await assertSameOrigin(req);
    if (originError) return originError;

    const owner = await requireOwnerUser();
    const { id: identifier } = await params;

    return await withOwnerDb(owner.id, async (client) => {
      const existing = await client.query.tasks.findFirst({
        where: taskWhereByIdentifier(owner.id, identifier),
        columns: { id: true, taskKey: true, projectId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      await client.delete(tasks).where(eq(tasks.id, existing.id));
      await writeOutboxEvent({
        tx: client,
        ownerId: owner.id,
        projectId: existing.projectId,
        eventType: TASK_DELETED,
        entityType: ENTITY_TASK,
        entityId: existing.taskKey,
      });

      await writeAuditLog(
        {
          ownerId: owner.id,
          action: 'task.deleted',
          targetType: 'task',
          targetId: identifier,
        },
        client,
      );

      return NextResponse.json({ ok: true, taskKey: existing.taskKey });
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
