import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { GET as getProjectSettingsRoute } from '@/app/api/projects/[id]/settings/route';
import { GET as listProjectsRoute } from '@/app/api/projects/route';
import { PATCH as patchQaRunRoute } from '@/app/api/qa-runs/[id]/route';
import {
  DELETE as deleteTaskRoute,
  GET as getTaskRoute,
  PATCH as patchTaskRoute,
} from '@/app/api/tasks/[id]/route';
import { PATCH as patchTaskStatusRoute } from '@/app/api/tasks/[id]/status/route';
import { GET as listTasksRoute, POST as createTaskRoute } from '@/app/api/tasks/route';
import { createInternalApiToken } from '@/lib/api-tokens';
import {
  DISPATCH_REQUEST_OBJECTIVES,
  DISPATCH_REQUEST_SCOPES,
  DISPATCH_REQUEST_STATES,
  DISPATCH_REQUEST_TARGETS,
  listDispatchRequests,
  updateDispatchRequestState,
} from '@/lib/dispatch-request-store';
import type { McpAuthContext } from '@/lib/mcp/context';

const PREQ_TASK_STATUSES = ['inbox', 'todo', 'hold', 'ready', 'done', 'archived'] as const;
const PREQ_TASK_RUN_STATES = ['queued', 'working'] as const;
const PREQ_TASK_DISPATCH_TARGETS = ['telegram', 'hermes-telegram', 'claude-code-channel'] as const;
const PREQ_TASK_LIST_DETAILS = ['simple', 'full'] as const;
const TASK_STATUS_ONLY_STATUSES = PREQ_TASK_STATUSES;
const PREQ_ENGINES = ['claude-code', 'codex', 'gemini-cli'] as const;
const PREQ_DISPATCH_REQUEST_SCOPES = DISPATCH_REQUEST_SCOPES;
const PREQ_DISPATCH_REQUEST_OBJECTIVES = DISPATCH_REQUEST_OBJECTIVES;
const PREQ_DISPATCH_REQUEST_STATES = DISPATCH_REQUEST_STATES;
const PREQ_DISPATCH_REQUEST_TARGETS = DISPATCH_REQUEST_TARGETS;
const PREQ_ENGINE_SET = new Set(PREQ_ENGINES);
const PREQ_DEFAULT_ENGINE: (typeof PREQ_ENGINES)[number] = 'codex';
const INTERNAL_BASE_URL = 'https://internal.preqstation.local';

type McpToolContext = McpAuthContext & {
  getDetectedClientEngine: () => (typeof PREQ_ENGINES)[number] | null;
};

function normalizeEngineValue(input: string | null | undefined) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return null;
  return PREQ_ENGINE_SET.has(value as (typeof PREQ_ENGINES)[number])
    ? (value as (typeof PREQ_ENGINES)[number])
    : null;
}

function normalizeRunStateValue(input: string | null | undefined) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return null;
  return PREQ_TASK_RUN_STATES.includes(value as (typeof PREQ_TASK_RUN_STATES)[number])
    ? (value as (typeof PREQ_TASK_RUN_STATES)[number])
    : null;
}

function normalizeDispatchTargetValue(input: string | null | undefined) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return null;
  return PREQ_TASK_DISPATCH_TARGETS.includes(value as (typeof PREQ_TASK_DISPATCH_TARGETS)[number])
    ? (value as (typeof PREQ_TASK_DISPATCH_TARGETS)[number])
    : null;
}

function normalizeDispatchRequestStateValue(input: string | null | undefined) {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return null;
  return PREQ_DISPATCH_REQUEST_STATES.includes(
    value as (typeof PREQ_DISPATCH_REQUEST_STATES)[number],
  )
    ? (value as (typeof PREQ_DISPATCH_REQUEST_STATES)[number])
    : null;
}

function resolveEngine(context: McpToolContext, primary?: string | null, fallback?: string | null) {
  return (
    normalizeEngineValue(primary) ||
    normalizeEngineValue(fallback) ||
    context.getDetectedClientEngine() ||
    PREQ_DEFAULT_ENGINE
  );
}

function encodeTaskId(taskId: string) {
  return encodeURIComponent(taskId.trim());
}

function toJsonText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function contentText(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : toJsonText(value),
      },
    ],
  };
}

export function summarizeTask(task: Record<string, unknown> | null | undefined) {
  return {
    id: task?.id ?? null,
    task_key: task?.task_key ?? task?.taskKey ?? null,
    title: task?.title ?? null,
    status: task?.status ?? null,
    run_state: task?.run_state ?? null,
    run_state_updated_at: task?.run_state_updated_at ?? null,
    priority: task?.priority ?? null,
    repo: task?.repo ?? null,
    engine: task?.engine ?? null,
    branch_name: task?.branch_name ?? task?.branchName ?? task?.branch ?? null,
    dispatch_target: task?.dispatch_target ?? task?.dispatchTarget ?? null,
    labels: Array.isArray(task?.labels) ? task.labels : [],
    updated_at: task?.updated_at ?? null,
  };
}

export function summarizeProject(project: Record<string, unknown> | null | undefined) {
  return {
    id: project?.id ?? null,
    key: project?.projectKey ?? null,
    name: project?.name ?? null,
    repoUrl: project?.repoUrl ?? null,
  };
}

export function summarizeDispatchRequest(request: Record<string, unknown> | null | undefined) {
  return {
    id: request?.id ?? null,
    scope: request?.scope ?? null,
    objective: request?.objective ?? null,
    state: request?.state ?? null,
    project_key: request?.projectKey ?? request?.project_key ?? null,
    task_key: request?.taskKey ?? request?.task_key ?? null,
    engine: request?.engine ?? null,
    branch_name: request?.branchName ?? request?.branch_name ?? null,
    dispatch_target: request?.dispatchTarget ?? request?.dispatch_target ?? null,
    prompt_metadata: request?.promptMetadata ?? request?.prompt_metadata ?? null,
    error_message: request?.errorMessage ?? request?.error_message ?? null,
    created_at: request?.createdAt ?? request?.created_at ?? null,
    updated_at: request?.updatedAt ?? request?.updated_at ?? null,
    dispatched_at: request?.dispatchedAt ?? request?.dispatched_at ?? null,
    failed_at: request?.failedAt ?? request?.failed_at ?? null,
  };
}

function normalizeProjectKey(input: string) {
  const normalized = input.trim().toUpperCase();
  if (!normalized) {
    throw new Error('projectKey is required.');
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(normalized)) {
    throw new Error('projectKey must use letters/numbers/underscore/hyphen and be 1-20 chars.');
  }
  return normalized;
}

function getTaskKey(task: Record<string, unknown>) {
  const taskKey = typeof task?.task_key === 'string' ? task.task_key.trim() : '';
  if (taskKey) return taskKey;
  const id = typeof task?.id === 'string' ? task.id.trim() : '';
  return id;
}

function belongsToProjectKey(task: Record<string, unknown>, projectKey: string) {
  const taskKey = getTaskKey(task).toUpperCase();
  return taskKey.startsWith(`${projectKey}-`);
}

function looksLikeJsonResponse(response: Response, trimmed: string) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return true;
  }

  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

async function readJsonResponse(response: Response, path: string) {
  const text = await response.text();
  const trimmed = text.trim();
  const looksLikeJson = looksLikeJsonResponse(response, trimmed);

  if (!response.ok) {
    let detail = '';
    if (trimmed && looksLikeJson) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const errorMessage =
          typeof parsed.error === 'string'
            ? parsed.error
            : typeof parsed.message === 'string'
              ? parsed.message
              : '';
        if (errorMessage) detail = `: ${errorMessage}`;
      } catch {
        // Fall back to the status-only message when the error body is not valid JSON.
      }
    }
    throw new Error(
      `PREQSTATION API request failed for ${path} with status ${response.status}${detail}.`,
    );
  }

  if (!trimmed) {
    return {};
  }

  if (!looksLikeJson) {
    throw new Error(
      `PREQSTATION API returned non-JSON success response for ${path} (status ${response.status}).`,
    );
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(
      `PREQSTATION API returned invalid JSON for ${path} (status ${response.status}).`,
    );
  }
}

async function createInternalRequest(
  context: McpToolContext,
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {},
) {
  const token = await createInternalApiToken({
    ownerId: context.userId,
    ownerEmail: context.userEmail,
    tokenName: 'MCP OAuth',
  });

  const headers = new Headers({
    authorization: `Bearer ${token}`,
  });

  if (init.body) {
    headers.set('content-type', 'application/json');
  }

  return new Request(`${INTERNAL_BASE_URL}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

async function callListTasks(context: McpToolContext, query: URLSearchParams) {
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const request = await createInternalRequest(context, `/api/tasks${suffix}`);
  const response = await listTasksRoute(request);
  return readJsonResponse(response, `/api/tasks${suffix}`);
}

async function callListProjects(context: McpToolContext) {
  const request = await createInternalRequest(context, '/api/projects');
  const response = await listProjectsRoute(request);
  return readJsonResponse(response, '/api/projects');
}

async function callCreateTask(context: McpToolContext, payload: Record<string, unknown>) {
  const request = await createInternalRequest(context, '/api/tasks', {
    method: 'POST',
    body: payload,
  });
  const response = await createTaskRoute(request);
  return readJsonResponse(response, '/api/tasks');
}

async function callGetTask(context: McpToolContext, taskId: string) {
  const request = await createInternalRequest(context, `/api/tasks/${encodeTaskId(taskId)}`);
  const response = await getTaskRoute(request, {
    params: Promise.resolve({ id: taskId }),
  });
  return readJsonResponse(response, `/api/tasks/${encodeTaskId(taskId)}`);
}

async function callPatchTask(
  context: McpToolContext,
  taskId: string,
  payload: Record<string, unknown>,
) {
  const request = await createInternalRequest(context, `/api/tasks/${encodeTaskId(taskId)}`, {
    method: 'PATCH',
    body: payload,
  });
  const response = await patchTaskRoute(request, {
    params: Promise.resolve({ id: taskId }),
  });
  return readJsonResponse(response, `/api/tasks/${encodeTaskId(taskId)}`);
}

async function callDeleteTask(context: McpToolContext, taskId: string) {
  const request = await createInternalRequest(context, `/api/tasks/${encodeTaskId(taskId)}`, {
    method: 'DELETE',
  });
  const response = await deleteTaskRoute(request, {
    params: Promise.resolve({ id: taskId }),
  });
  return readJsonResponse(response, `/api/tasks/${encodeTaskId(taskId)}`);
}

async function callPatchTaskStatus(
  context: McpToolContext,
  taskId: string,
  payload: Record<string, unknown>,
) {
  const request = await createInternalRequest(
    context,
    `/api/tasks/${encodeTaskId(taskId)}/status`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
  const response = await patchTaskStatusRoute(request, {
    params: Promise.resolve({ id: taskId }),
  });
  return readJsonResponse(response, `/api/tasks/${encodeTaskId(taskId)}/status`);
}

async function callGetProjectSettings(context: McpToolContext, projectKey: string) {
  const request = await createInternalRequest(
    context,
    `/api/projects/${encodeURIComponent(projectKey)}/settings`,
  );
  const response = await getProjectSettingsRoute(request, {
    params: Promise.resolve({ id: projectKey }),
  });
  return readJsonResponse(response, `/api/projects/${encodeURIComponent(projectKey)}/settings`);
}

async function callPatchQaRun(
  context: McpToolContext,
  runId: string,
  payload: Record<string, unknown>,
) {
  const request = await createInternalRequest(context, `/api/qa-runs/${encodeTaskId(runId)}`, {
    method: 'PATCH',
    body: payload,
  });
  const response = await patchQaRunRoute(request, {
    params: Promise.resolve({ id: runId }),
  });
  return readJsonResponse(response, `/api/qa-runs/${encodeTaskId(runId)}`);
}

export function registerPreqTools(server: McpServer, context: McpToolContext) {
  server.registerTool(
    'preq_list_dispatch_requests',
    {
      title: 'List PREQSTATION dispatch requests',
      description:
        'List explicit dispatch requests for non-legacy Claude/OpenClaw flows such as ask parity and project-level insight.',
      inputSchema: {
        state: z.enum(PREQ_DISPATCH_REQUEST_STATES).optional(),
        objective: z.enum(PREQ_DISPATCH_REQUEST_OBJECTIVES).optional(),
        scope: z.enum(PREQ_DISPATCH_REQUEST_SCOPES).optional(),
        dispatchTarget: z.enum(PREQ_DISPATCH_REQUEST_TARGETS).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ state, objective, scope, dispatchTarget, limit }) => {
      const requests = await listDispatchRequests({
        ownerId: context.userId,
        state: normalizeDispatchRequestStateValue(state),
        objective: objective ?? null,
        dispatchTarget: dispatchTarget ?? null,
        limit: typeof limit === 'number' ? limit : 200,
      });

      const scoped = scope ? requests.filter((request) => request.scope === scope) : requests;

      return contentText({
        count: scoped.length,
        requests: scoped.map((request) => summarizeDispatchRequest(request)),
      });
    },
  );

  server.registerTool(
    'preq_update_dispatch_request',
    {
      title: 'Update PREQSTATION dispatch request state',
      description:
        'Mark an explicit dispatch request as dispatched or failed after the external launcher handles it.',
      inputSchema: {
        requestId: z.string().trim().min(1),
        state: z.enum(PREQ_DISPATCH_REQUEST_STATES),
        errorMessage: z.string().trim().max(4000).optional(),
      },
    },
    async ({ requestId, state, errorMessage }) =>
      contentText({
        request: summarizeDispatchRequest(
          await updateDispatchRequestState({
            ownerId: context.userId,
            requestId,
            state,
            errorMessage: errorMessage || null,
          }),
        ),
      }),
  );

  server.registerTool(
    'preq_list_projects',
    {
      title: 'List PREQSTATION projects',
      description: 'List PREQSTATION projects for setup flows such as local repository mapping.',
      inputSchema: {},
    },
    async () => {
      const result = await callListProjects(context);
      const projects = Array.isArray(result.projects) ? result.projects : [];

      return contentText({
        count: projects.length,
        projects: projects.map((project) => summarizeProject(project as Record<string, unknown>)),
      });
    },
  );

  server.registerTool(
    'preq_list_tasks',
    {
      title: 'List PREQSTATION tasks',
      description:
        'List PREQSTATION tasks by status/label/engine. Use this when no ticket number is provided and you need to pick work.',
      inputSchema: {
        status: z.enum(PREQ_TASK_STATUSES).optional(),
        label: z.string().trim().min(1).max(40).optional(),
        projectKey: z.string().trim().min(1).max(20).optional(),
        engine: z.enum(PREQ_ENGINES).optional(),
        runState: z.enum(PREQ_TASK_RUN_STATES).optional(),
        dispatchTarget: z.enum(PREQ_TASK_DISPATCH_TARGETS).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        detail: z.enum(PREQ_TASK_LIST_DETAILS).optional(),
      },
    },
    async ({ status, label, projectKey, engine, runState, dispatchTarget, limit, detail }) => {
      const resolvedEngine = resolveEngine(context, engine);
      const normalizedProjectKey = projectKey ? normalizeProjectKey(projectKey) : null;
      const detailMode = detail ?? 'simple';
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (label) query.set('label', label);
      query.set('engine', resolvedEngine);
      if (runState) query.set('run_state', runState);
      if (dispatchTarget) query.set('dispatch_target', dispatchTarget);
      if (normalizedProjectKey) query.set('project_key', normalizedProjectKey);
      if (typeof limit === 'number') query.set('limit', String(limit));
      if (detailMode === 'simple') query.set('compact', '1');
      const result = await callListTasks(context, query);
      const tasks = Array.isArray(result.tasks) ? result.tasks : [];
      const requestedEngine = normalizeEngineValue(engine) || context.getDetectedClientEngine();
      const requestedRunState = normalizeRunStateValue(runState);
      const requestedDispatchTarget = normalizeDispatchTargetValue(dispatchTarget);
      const filtered = tasks.filter((task) => {
        const taskRecord = task as Record<string, unknown>;
        if (normalizedProjectKey && !belongsToProjectKey(taskRecord, normalizedProjectKey)) {
          return false;
        }
        if (
          requestedEngine &&
          normalizeEngineValue(taskRecord.engine as string | null) !== requestedEngine
        ) {
          return false;
        }
        if (
          requestedRunState &&
          normalizeRunStateValue(taskRecord.run_state as string | null) !== requestedRunState
        ) {
          return false;
        }
        if (
          requestedDispatchTarget &&
          normalizeDispatchTargetValue(taskRecord.dispatch_target as string | null) !==
            requestedDispatchTarget
        ) {
          return false;
        }
        return true;
      });
      const sliced = limit ? filtered.slice(0, limit) : filtered;

      return contentText({
        count: sliced.length,
        total: filtered.length,
        total_api_tasks: tasks.length,
        detail: detailMode,
        project_key: normalizedProjectKey,
        tasks:
          detailMode === 'full'
            ? sliced
            : sliced.map((task) => summarizeTask(task as Record<string, unknown>)),
      });
    },
  );

  server.registerTool(
    'preq_get_task',
    {
      title: 'Get PREQSTATION task',
      description: 'Get detailed task payload by ticket number like TEST-4 or UUID.',
      inputSchema: {
        taskId: z.string().trim().min(1),
      },
    },
    async ({ taskId }) => contentText(await callGetTask(context, taskId)),
  );

  server.registerTool(
    'preq_get_project_settings',
    {
      title: 'Get PREQSTATION project settings',
      description:
        'Get project settings by project key (deploy_strategy/deploy_default_branch/deploy_auto_pr/deploy_commit_on_review/deploy_squash_merge).',
      inputSchema: {
        projectKey: z.string().trim().min(1).max(20),
      },
    },
    async ({ projectKey }) => {
      const normalizedProjectKey = normalizeProjectKey(projectKey);
      const result = await callGetProjectSettings(context, normalizedProjectKey);
      return contentText({
        project_key: normalizedProjectKey,
        settings: result?.settings || {},
      });
    },
  );

  server.registerTool(
    'preq_update_qa_run',
    {
      title: 'Update PREQSTATION QA run',
      description:
        'Update a branch-level QA run with running/passed/failed status, target URL, markdown report, and summary counts.',
      inputSchema: {
        runId: z.string().trim().min(1),
        status: z.enum(['running', 'passed', 'failed'] as const).optional(),
        targetUrl: z.string().trim().url().optional(),
        reportMarkdown: z.string().optional(),
        summary: z
          .object({
            total: z.number().int().min(0),
            critical: z.number().int().min(0),
            high: z.number().int().min(0),
            medium: z.number().int().min(0),
            low: z.number().int().min(0),
          })
          .optional(),
      },
    },
    async ({ runId, status, targetUrl, reportMarkdown, summary }) => {
      const payload: Record<string, unknown> = {};
      if (status) payload.status = status;
      if (targetUrl) payload.target_url = targetUrl;
      if (typeof reportMarkdown === 'string') payload.report_markdown = reportMarkdown;
      if (summary) payload.summary = summary;
      return contentText(await callPatchQaRun(context, runId, payload));
    },
  );

  server.registerTool(
    'preq_plan_task',
    {
      title: 'Plan task and move to Todo',
      description:
        'Improve an existing project task by uploading generated plan content and moving the card to todo. Use after reading local code and generating plan with LLM.',
      inputSchema: {
        projectKey: z.string().trim().min(1).max(20),
        taskId: z.string().trim().min(1),
        planMarkdown: z.string().trim().min(1).max(50000),
        acceptanceCriteria: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
        priority: z
          .enum(['highest', 'high', 'medium', 'none', 'low', 'lowest'] as const)
          .optional(),
        labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ projectKey, taskId, planMarkdown, acceptanceCriteria, priority, labels, engine }) => {
      const normalizedProjectKey = normalizeProjectKey(projectKey);
      const found = await callGetTask(context, taskId);
      const task = (found.task || found) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(context, engine, task?.engine as string | undefined);

      if (!belongsToProjectKey(task, normalizedProjectKey)) {
        throw new Error(`Task ${taskId} does not belong to project key ${normalizedProjectKey}.`);
      }

      const payload: Record<string, unknown> = {
        lifecycle_action: 'plan',
        planMarkdown,
        engine: resolvedEngine,
      };
      if (acceptanceCriteria) payload.acceptance_criteria = acceptanceCriteria;
      if (priority) payload.priority = priority;
      if (labels) payload.labels = labels;

      const result = await callPatchTask(context, taskId, payload);
      return contentText({
        task: result.task || null,
        project_key: normalizedProjectKey,
        lifecycle_action: 'plan',
        plan_updated: true,
      });
    },
  );

  server.registerTool(
    'preq_create_task',
    {
      title: 'Create PREQSTATION task (Inbox)',
      description:
        'Create a new PREQSTATION task and place it in Inbox. This uses /api/tasks and omits status so server default maps to internal inbox.',
      inputSchema: {
        title: z.string().trim().min(1).max(180),
        repo: z.string().trim().min(1).max(2000),
        description: z.string().trim().max(50000).optional(),
        priority: z
          .enum(['highest', 'high', 'medium', 'none', 'low', 'lowest'] as const)
          .optional(),
        labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        acceptanceCriteria: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
        branch: z.string().trim().max(200).optional(),
        assignee: z.string().trim().max(120).optional(),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({
      title,
      repo,
      description,
      priority,
      labels,
      acceptanceCriteria,
      branch,
      assignee,
      engine,
    }) => {
      const resolvedEngine = resolveEngine(context, engine);
      const payload: Record<string, unknown> = {
        title,
        repo,
        description: description || '',
        engine: resolvedEngine,
        priority: priority || 'none',
      };
      if (labels) payload.labels = labels;
      if (acceptanceCriteria) payload.acceptance_criteria = acceptanceCriteria;
      if (branch) payload.branch = branch;
      if (assignee) payload.assignee = assignee;

      const result = await callCreateTask(context, payload);
      return contentText({
        task: result.task || null,
        requested_status: 'inbox',
      });
    },
  );

  server.registerTool(
    'preq_start_task',
    {
      title: 'Start PREQSTATION task',
      description: 'Claim task execution and mark run_state=working before any substantive work.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, engine }) => {
      const existing = await callGetTask(context, taskId);
      const existingTask = (existing.task || existing) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(
        context,
        engine,
        existingTask?.engine as string | undefined,
      );
      const result = await callPatchTask(context, taskId, {
        engine: resolvedEngine,
        lifecycle_action: 'start',
      });

      return contentText({
        task: result.task || null,
        lifecycle_action: 'start',
      });
    },
  );

  server.registerTool(
    'preq_update_task_note',
    {
      title: 'Update PREQSTATION task note',
      description:
        'Replace the current task note markdown without changing workflow status. Use this for ask-style rewrites after preq_start_task.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        noteMarkdown: z.string().max(50000),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, noteMarkdown, engine }) => {
      const existing = await callGetTask(context, taskId);
      const existingTask = (existing.task || existing) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(
        context,
        engine,
        existingTask?.engine as string | undefined,
      );
      const result = await callPatchTask(context, taskId, {
        noteMarkdown,
        engine: resolvedEngine,
      });

      return contentText({
        task: result.task || null,
        note_updated: true,
      });
    },
  );

  server.registerTool(
    'preq_update_task_status',
    {
      title: 'Update PREQSTATION task status only',
      description: 'Update only task status via the status-only endpoint.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        status: z.enum(TASK_STATUS_ONLY_STATUSES),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, status, engine }) => {
      const existing = await callGetTask(context, taskId);
      const existingTask = (existing.task || existing) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(
        context,
        engine,
        existingTask?.engine as string | undefined,
      );
      return contentText(
        await callPatchTaskStatus(context, taskId, {
          status,
          engine: resolvedEngine,
        }),
      );
    },
  );

  server.registerTool(
    'preq_complete_task',
    {
      title: 'Submit PREQSTATION task as ready',
      description:
        'After work is done, upload execution result, move task to ready, and clear run_state. Result is saved into PREQSTATION work logs for verification.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        summary: z.string().trim().min(1).max(4000),
        tests: z.string().trim().max(4000).optional(),
        prUrl: z.string().trim().url().optional(),
        notes: z.string().trim().max(8000).optional(),
        branchName: z.string().trim().max(200).optional(),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, summary, tests, prUrl, notes, branchName, engine }) => {
      const existing = await callGetTask(context, taskId);
      const existingTask = (existing.task || existing) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(
        context,
        engine,
        existingTask?.engine as string | undefined,
      );
      const resolvedBranchName =
        (typeof branchName === 'string' ? branchName.trim() : '') ||
        (typeof existingTask?.branch === 'string' ? existingTask.branch.trim() : '');

      const resultPayload: Record<string, unknown> = {
        summary,
        tests: tests || '',
        pr_url: prUrl || '',
        notes: notes || '',
        engine: resolvedEngine,
        completed_at: new Date().toISOString(),
      };
      if (resolvedBranchName) resultPayload.branch = resolvedBranchName;

      const result = await callPatchTask(context, taskId, {
        lifecycle_action: 'complete',
        result: resultPayload,
        branch: resolvedBranchName || undefined,
        engine: resolvedEngine,
      });

      return contentText({
        task: result.task || null,
        lifecycle_action: 'complete',
        uploaded_result: resultPayload,
      });
    },
  );

  server.registerTool(
    'preq_review_task',
    {
      title: 'Review PREQSTATION task',
      description:
        'Verify completed work and move task from ready to done. Run verification (tests, build, lint) before calling this tool. On verification failure, use preq_block_task instead.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        summary: z.string().trim().min(1).max(4000).optional(),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, summary, engine }) => {
      const existing = await callGetTask(context, taskId);
      const existingTask = (existing.task || existing) as Record<string, unknown>;
      const resolvedEngine = resolveEngine(
        context,
        engine,
        existingTask?.engine as string | undefined,
      );
      const resultPayload = {
        summary: summary || 'All checks passed',
        engine: resolvedEngine,
        verified_at: new Date().toISOString(),
      };
      const result = await callPatchTask(context, taskId, {
        lifecycle_action: 'review',
        result: resultPayload,
        engine: resolvedEngine,
      });
      return contentText({
        task: result.task || null,
        uploaded_result: resultPayload,
      });
    },
  );

  server.registerTool(
    'preq_delete_task',
    {
      title: 'Delete PREQSTATION task',
      description: 'Permanently delete a task by ticket number or UUID.',
      inputSchema: {
        taskId: z.string().trim().min(1),
      },
    },
    async ({ taskId }) => {
      await callDeleteTask(context, taskId);
      return contentText({ deleted: true, taskId });
    },
  );

  server.registerTool(
    'preq_block_task',
    {
      title: 'Block PREQSTATION task',
      description: 'Move task to hold, clear run_state, and upload blocking reason.',
      inputSchema: {
        taskId: z.string().trim().min(1),
        reason: z.string().trim().min(1).max(4000),
        engine: z.enum(PREQ_ENGINES).optional(),
      },
    },
    async ({ taskId, reason, engine }) => {
      const resolvedEngine = resolveEngine(context, engine);
      const resultPayload = {
        reason,
        engine: resolvedEngine,
        blocked_at: new Date().toISOString(),
      };
      const result = await callPatchTask(context, taskId, {
        lifecycle_action: 'block',
        result: resultPayload,
        engine: resolvedEngine,
      });
      return contentText({
        task: result.task || null,
        uploaded_result: resultPayload,
      });
    },
  );
}
