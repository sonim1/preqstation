import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_BASE_URL } from './test-utils';

const mocked = vi.hoisted(() => {
  const returningFn = vi.fn().mockResolvedValue([]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const txInsert = vi.fn().mockReturnValue({ values: valuesFn });

  return {
    authenticateApiToken: vi.fn(),
    writeAuditLog: vi.fn(),
    writeOutboxEvent: vi.fn(),
    resolveAppendSortOrder: vi.fn(),
    serializePreqTask: vi.fn(),
    resolveProjectByRepo: vi.fn(),
    resolveOrCreateLabelId: vi.fn(),
    firstTaskLabel: vi.fn(),
    normalizePreqTaskLabelNames: vi.fn(),
    buildTaskNote: vi.fn(),
    normalizeTaskPriority: vi.fn(),
    toInternalTaskStatus: vi.fn(),
    toPreqTaskStatus: vi.fn(),
    toPreqTaskRunState: vi.fn(),
    toPreqTaskDispatchTarget: vi.fn(),
    generateBranchName: vi.fn(),
    resolveNextTaskKey: vi.fn(),
    fetchAvailableLabels: vi.fn(),
    db: {
      query: {
        tasks: { findMany: vi.fn(), findFirst: vi.fn() },
        projects: { findFirst: vi.fn() },
        taskLabels: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      transaction: vi.fn(),
    },
    txInsert,
    txValuesFn: valuesFn,
    txReturningFn: returningFn,
  };
});

vi.mock('@/lib/api-tokens', () => ({
  authenticateApiToken: mocked.authenticateApiToken,
}));

vi.mock('@/lib/audit', () => ({
  writeAuditLog: mocked.writeAuditLog,
}));

vi.mock('@/lib/outbox', () => ({
  writeOutboxEvent: mocked.writeOutboxEvent,
  ENTITY_TASK: 'Todo',
  TASK_CREATED: 'TASK_CREATED',
}));

vi.mock('@/lib/preq-task', () => ({
  serializePreqTask: mocked.serializePreqTask,
  resolveProjectByRepo: mocked.resolveProjectByRepo,
  resolveOrCreateLabelId: mocked.resolveOrCreateLabelId,
  firstTaskLabel: mocked.firstTaskLabel,
  normalizePreqTaskLabelNames: mocked.normalizePreqTaskLabelNames,
  buildTaskNote: mocked.buildTaskNote,
  normalizeTaskPriority: mocked.normalizeTaskPriority,
  toInternalTaskStatus: mocked.toInternalTaskStatus,
  toPreqTaskStatus: mocked.toPreqTaskStatus,
  toPreqTaskRunState: mocked.toPreqTaskRunState,
  toPreqTaskDispatchTarget: mocked.toPreqTaskDispatchTarget,
  generateBranchName: mocked.generateBranchName,
  fetchAvailableLabels: mocked.fetchAvailableLabels,
  PREQ_TASK_STATUSES: ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'],
}));

vi.mock('@/lib/task-keys', () => ({
  resolveNextTaskKey: mocked.resolveNextTaskKey,
  isTaskKeyUniqueConstraintError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/task-sort-order', () => ({
  resolveAppendSortOrder: mocked.resolveAppendSortOrder,
  TASK_BOARD_ORDER: ['task-board-order'],
}));

vi.mock('@/lib/db', () => ({
  db: mocked.db,
}));

vi.mock('@/lib/db/rls', () => ({
  withOwnerDb: async (_ownerId: string, callback: (client: Record<string, unknown>) => unknown) =>
    mocked.db.transaction(async (tx: Record<string, unknown>) =>
      callback({ ...mocked.db, ...tx, query: mocked.db.query }),
    ),
}));

import { GET, POST } from '@/app/api/tasks/route';

const AUTH = {
  ownerId: 'owner-1',
  ownerEmail: 'owner@example.com',
  tokenId: 'token-1',
  tokenName: 'PREQSTATION Token',
};

const BASE_TODO = {
  id: 'todo-1',
  taskKey: 'NONE-1',
  taskPrefix: 'NONE',
  taskNumber: 1,
  title: 'Task A',
  note: null,
  status: 'inbox',
  taskPriority: 'none',
  branch: 'none-1-task-a',
  engine: null,
  createdAt: new Date('2026-02-18T00:00:00.000Z'),
  updatedAt: new Date('2026-02-18T00:00:00.000Z'),
  projectId: null,
  project: null,
  label: null,
};

const SERIALIZED_TASK = {
  id: 'NONE-1',
  title: 'Task A',
  status: 'inbox',
  assignee: 'owner@example.com',
};

function jsonRequest(method: 'GET' | 'POST', url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('app/api/tasks/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocked.authenticateApiToken.mockResolvedValue(AUTH);
    mocked.writeAuditLog.mockResolvedValue(undefined);
    mocked.writeOutboxEvent.mockResolvedValue(undefined);
    mocked.resolveAppendSortOrder.mockResolvedValue('a1');
    mocked.serializePreqTask.mockReturnValue(SERIALIZED_TASK);
    mocked.resolveProjectByRepo.mockResolvedValue(null);
    mocked.resolveOrCreateLabelId.mockResolvedValue('label-1');
    mocked.firstTaskLabel.mockReturnValue(undefined);
    mocked.normalizePreqTaskLabelNames.mockImplementation((labels?: string[]) => labels ?? []);
    mocked.buildTaskNote.mockReturnValue(null);
    mocked.normalizeTaskPriority.mockReturnValue('none');
    mocked.toInternalTaskStatus.mockReturnValue(undefined);
    mocked.toPreqTaskStatus.mockImplementation((value: string) => value);
    mocked.toPreqTaskRunState.mockImplementation(
      (value: string | null | undefined) => value ?? null,
    );
    mocked.toPreqTaskDispatchTarget.mockImplementation(
      (value: string | null | undefined) => value ?? null,
    );
    mocked.generateBranchName.mockReturnValue('none-1-task-a');
    mocked.resolveNextTaskKey.mockResolvedValue({
      taskKey: 'NONE-1',
      taskPrefix: 'NONE',
      taskNumber: 1,
    });
    mocked.fetchAvailableLabels.mockResolvedValue([]);

    mocked.db.query.tasks.findMany.mockResolvedValue([]);
    mocked.db.query.tasks.findFirst.mockResolvedValue(null);
    mocked.db.query.projects.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findFirst.mockResolvedValue(null);
    mocked.db.query.taskLabels.findMany.mockResolvedValue([]);
    mocked.txReturningFn.mockResolvedValue([BASE_TODO]);
    mocked.db.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        insert: mocked.txInsert,
      });
    });
  });

  // ─── GET /api/tasks ───────────────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 when token is missing or invalid', async () => {
      mocked.authenticateApiToken.mockResolvedValueOnce(null);

      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks`));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('returns tasks for the authenticated token owner', async () => {
      mocked.db.query.tasks.findMany.mockResolvedValueOnce([BASE_TODO]);

      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks`));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ tasks: [SERIALIZED_TASK], available_labels: [] });
      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('returns project-scoped available labels when project_key is supplied', async () => {
      mocked.db.query.projects.findFirst.mockResolvedValueOnce({ id: 'project-1' });
      mocked.fetchAvailableLabels.mockResolvedValueOnce([{ name: 'bug', color: 'red' }]);

      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?project_key=TEST`));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ tasks: [], available_labels: [{ name: 'bug', color: 'red' }] });
      expect(mocked.fetchAvailableLabels).toHaveBeenCalledWith(
        'owner-1',
        'project-1',
        expect.anything(),
      );
    });

    it('returns empty tasks list when owner has no tasks', async () => {
      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks`));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ tasks: [], available_labels: [] });
    });

    it('filters by status=inbox maps to inbox only', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=inbox`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('filters by status=todo maps to todo only', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=todo`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('filters by status=hold maps to hold', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=hold`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('rejects legacy blocked status filter', async () => {
      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=blocked`));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('filters by status=ready maps to ready', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=ready`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('rejects legacy review status filter', async () => {
      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=review`));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('rejects legacy in_progress status filter', async () => {
      const response = await GET(
        jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=in_progress`),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('filters by status=done maps to done', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?status=done`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('filters by label name', async () => {
      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?label=bug`));

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('accepts engine, run_state, and dispatch_target query parameters', async () => {
      await GET(
        jsonRequest(
          'GET',
          `${TEST_BASE_URL}/api/tasks?engine=claude-code&run_state=queued&dispatch_target=telegram`,
        ),
      );

      expect(mocked.db.query.tasks.findMany).toHaveBeenCalled();
    });

    it('rejects invalid engine query parameter', async () => {
      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?engine=claude`));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid run_state query parameter', async () => {
      const response = await GET(
        jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?run_state=working`),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('rejects invalid dispatch_target query parameter', async () => {
      const response = await GET(
        jsonRequest('GET', `${TEST_BASE_URL}/api/tasks?dispatch_target=slack`),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid query' });
      expect(mocked.db.query.tasks.findMany).not.toHaveBeenCalled();
    });

    it('serializes each task through serializePreqTask', async () => {
      mocked.db.query.tasks.findMany.mockResolvedValueOnce([
        BASE_TODO,
        { ...BASE_TODO, id: 'todo-2', taskKey: 'NONE-2' },
      ]);

      const response = await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks`));
      const body = await response.json();

      expect(mocked.serializePreqTask).toHaveBeenCalledTimes(2);
      expect(body.tasks).toHaveLength(2);
    });

    it('passes every assigned label to serializePreqTask', async () => {
      mocked.db.query.tasks.findMany.mockResolvedValueOnce([
        {
          ...BASE_TODO,
          label: null,
          labelAssignments: [
            { position: 0, label: { id: 'label-bug', name: 'bug', color: 'red' } },
            { position: 1, label: { id: 'label-frontend', name: 'frontend', color: '#228be6' } },
          ],
        },
      ]);

      await GET(jsonRequest('GET', `${TEST_BASE_URL}/api/tasks`));

      expect(mocked.serializePreqTask).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: [{ name: 'bug' }, { name: 'frontend' }],
        }),
        'owner@example.com',
      );
    });

    it('returns compact task summaries for MCP list queries without available labels', async () => {
      mocked.db.query.tasks.findMany.mockResolvedValueOnce([
        {
          ...BASE_TODO,
          project: { repoUrl: 'https://github.com/acme/app' },
          runState: 'queued',
          runStateUpdatedAt: new Date('2026-02-18T01:00:00.000Z'),
          dispatchTarget: 'telegram',
          labelAssignments: [{ position: 0, label: { id: 'label-bug', name: 'bug' } }],
        },
      ]);

      const response = await GET(
        jsonRequest(
          'GET',
          `${TEST_BASE_URL}/api/tasks?compact=1&limit=10&project_key=none&run_state=queued&dispatch_target=telegram`,
        ),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        tasks: [
          {
            id: 'NONE-1',
            task_key: 'NONE-1',
            title: 'Task A',
            status: 'inbox',
            run_state: 'queued',
            run_state_updated_at: '2026-02-18T01:00:00.000Z',
            priority: 'none',
            repo: 'https://github.com/acme/app',
            engine: null,
            branch_name: 'none-1-task-a',
            dispatch_target: 'telegram',
            labels: ['bug'],
            updated_at: '2026-02-18T00:00:00.000Z',
          },
        ],
      });
      expect(mocked.serializePreqTask).not.toHaveBeenCalled();
      expect(mocked.fetchAvailableLabels).not.toHaveBeenCalled();
      expect(mocked.db.query.tasks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          columns: expect.objectContaining({
            id: true,
            taskKey: true,
            title: true,
            taskPriority: true,
            runState: true,
            updatedAt: true,
          }),
        }),
      );
    });
  });

  // ─── POST /api/tasks ──────────────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 when token is missing or invalid', async () => {
      mocked.authenticateApiToken.mockResolvedValueOnce(null);

      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      expect(mocked.txInsert).not.toHaveBeenCalled();
    });

    it('rejects payload containing task identity fields (taskKey)', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, { title: 'Task A', taskKey: 'TEST-10' }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Task ID is auto-generated and cannot be set manually.',
      });
      expect(mocked.txInsert).not.toHaveBeenCalled();
    });

    it('rejects payload containing id field', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, { title: 'Task A', id: 'some-uuid' }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Task ID is auto-generated and cannot be set manually.',
      });
    });

    it('rejects payload containing taskPrefix field', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, { title: 'Task A', taskPrefix: 'TEST' }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Task ID is auto-generated and cannot be set manually.',
      });
    });

    it('rejects payload containing taskNumber field', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, { title: 'Task A', taskNumber: 5 }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Task ID is auto-generated and cannot be set manually.',
      });
    });

    it('returns 400 for Zod schema validation errors (empty title)', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: '',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          error: 'Invalid payload',
          issues: expect.any(Array),
        }),
      );
      expect(mocked.txInsert).not.toHaveBeenCalled();
    });

    it('returns 400 for Zod schema validation errors (missing title)', async () => {
      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, { repo: 'https://github.com/acme/app' }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          error: 'Invalid payload',
          issues: expect.any(Array),
        }),
      );
    });

    it('creates task with NONE prefix when repo does not match any project', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce(null);

      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/unknown/repo',
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'No project found for the given repo.' });
      expect(mocked.txInsert).not.toHaveBeenCalled();
    });

    it('creates task and returns 201 with serialized task', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      const createdTask = {
        ...BASE_TODO,
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
        projectId: 'project-1',
        project: { repoUrl: 'https://github.com/acme/app' },
      };
      mocked.txReturningFn.mockResolvedValueOnce([createdTask]);
      mocked.db.query.tasks.findFirst.mockResolvedValueOnce(createdTask);

      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(response.status).toBe(201);
      expect(mocked.serializePreqTask).toHaveBeenCalledWith(
        expect.objectContaining({ taskKey: 'TEST-1' }),
        'owner@example.com',
      );
    });

    it('assigns the next sortOrder in the target status', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.db.query.tasks.findFirst.mockResolvedValueOnce({ ...BASE_TODO, taskKey: 'TEST-1' });
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, taskKey: 'TEST-1' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 'a1' }));
    });

    it('uses resolveAppendSortOrder for the requested status', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.resolveAppendSortOrder.mockResolvedValueOnce('z0');
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, taskKey: 'TEST-1' }]);
      mocked.db.query.tasks.findFirst.mockResolvedValueOnce({ ...BASE_TODO, taskKey: 'TEST-1' });
      mocked.toInternalTaskStatus.mockReturnValueOnce('inbox');

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          status: 'inbox',
        }),
      );

      expect(mocked.resolveAppendSortOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.anything(),
          ownerId: 'owner-1',
          status: 'inbox',
        }),
      );
      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 'z0' }));
    });

    it('creates task with inbox status by default', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.toInternalTaskStatus.mockReturnValueOnce(undefined);
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, status: 'inbox' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'inbox' }));
    });

    it('uses provided status when valid', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.toInternalTaskStatus.mockReturnValueOnce('todo');
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, status: 'todo' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          status: 'todo',
        }),
      );

      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'todo' }));
    });

    it('assigns label when labels array is provided', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.firstTaskLabel.mockReturnValueOnce('bug');
      mocked.resolveOrCreateLabelId.mockResolvedValueOnce('label-bug');
      mocked.txReturningFn.mockResolvedValueOnce([
        {
          ...BASE_TODO,
          labelId: 'label-bug',
          label: { name: 'bug' },
        },
      ]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          labels: ['bug'],
        }),
      );

      expect(mocked.resolveOrCreateLabelId).toHaveBeenCalledWith(
        'owner-1',
        'project-1',
        'bug',
        expect.anything(),
      );
      expect(mocked.txValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ labelId: 'label-bug' }),
      );
    });

    it('serializes every label when multiple labels are provided on create', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.resolveOrCreateLabelId
        .mockResolvedValueOnce('label-bug')
        .mockResolvedValueOnce('label-frontend');
      mocked.txReturningFn.mockResolvedValueOnce([
        {
          ...BASE_TODO,
          taskKey: 'TEST-1',
          taskPrefix: 'TEST',
          taskNumber: 1,
          labelId: 'label-bug',
          projectId: 'project-1',
        },
      ]);
      mocked.db.query.tasks.findFirst.mockResolvedValueOnce({
        ...BASE_TODO,
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
        projectId: 'project-1',
        project: { repoUrl: 'https://github.com/acme/app' },
        label: null,
        labelAssignments: [
          { position: 0, label: { id: 'label-bug', name: 'bug', color: 'red' } },
          { position: 1, label: { id: 'label-frontend', name: 'frontend', color: '#228be6' } },
        ],
      });

      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          labels: ['bug', 'frontend'],
        }),
      );

      expect(response.status).toBe(201);
      expect(mocked.resolveOrCreateLabelId).toHaveBeenNthCalledWith(
        1,
        'owner-1',
        'project-1',
        'bug',
        expect.anything(),
      );
      expect(mocked.resolveOrCreateLabelId).toHaveBeenNthCalledWith(
        2,
        'owner-1',
        'project-1',
        'frontend',
        expect.anything(),
      );
      expect(mocked.serializePreqTask).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: [{ name: 'bug' }, { name: 'frontend' }],
        }),
        'owner@example.com',
      );
    });

    it('returns available_labels scoped to the created task project', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, projectId: 'project-1' }]);
      mocked.fetchAvailableLabels.mockResolvedValueOnce([{ name: 'bug', color: 'red' }]);

      const response = await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.available_labels).toEqual([{ name: 'bug', color: 'red' }]);
      expect(mocked.fetchAvailableLabels).toHaveBeenCalledWith(
        'owner-1',
        'project-1',
        expect.anything(),
      );
    });

    it('sets engine from payload when provided', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, engine: 'codex' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          engine: 'codex',
        }),
      );

      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ engine: 'codex' }));
    });

    it('does not auto-assign engine when not provided', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, engine: null }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(mocked.txValuesFn).toHaveBeenCalledWith(expect.objectContaining({ engine: null }));
    });

    it('writes audit log after task creation', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, taskKey: 'TEST-1' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(mocked.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'owner-1',
          action: 'task.created.via_api_token',
          targetType: 'task',
          targetId: 'TEST-1',
          meta: expect.objectContaining({ tokenId: 'token-1', tokenName: 'PREQSTATION Token' }),
        }),
        expect.anything(),
      );
    });

    it('generates branch name when branch is not provided', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.generateBranchName.mockReturnValueOnce('test-1-task-a');
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, branch: 'test-1-task-a' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
        }),
      );

      expect(mocked.generateBranchName).toHaveBeenCalledWith('TEST-1', 'Task A');
      expect(mocked.txValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'test-1-task-a' }),
      );
    });

    it('uses provided branch name when given', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.txReturningFn.mockResolvedValueOnce([
        {
          ...BASE_TODO,
          branch: 'feature/my-branch',
        },
      ]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          branch: 'feature/my-branch',
        }),
      );

      expect(mocked.generateBranchName).not.toHaveBeenCalled();
      expect(mocked.txValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'feature/my-branch' }),
      );
    });

    it('includes acceptance_criteria in task note', async () => {
      mocked.resolveProjectByRepo.mockResolvedValueOnce({ id: 'project-1', projectKey: 'TEST' });
      mocked.resolveNextTaskKey.mockResolvedValueOnce({
        taskKey: 'TEST-1',
        taskPrefix: 'TEST',
        taskNumber: 1,
      });
      mocked.buildTaskNote.mockReturnValueOnce('Note with AC');
      mocked.txReturningFn.mockResolvedValueOnce([{ ...BASE_TODO, note: 'Note with AC' }]);

      await POST(
        jsonRequest('POST', `${TEST_BASE_URL}/api/tasks`, {
          title: 'Task A',
          repo: 'https://github.com/acme/app',
          description: 'Some description',
          acceptance_criteria: ['AC1', 'AC2'],
        }),
      );

      expect(mocked.buildTaskNote).toHaveBeenCalledWith('Some description', ['AC1', 'AC2']);
    });
  });
});
