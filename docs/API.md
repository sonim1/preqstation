# API

PreqStation exposes three agent integration surfaces.

- **REST API** for shell helpers and direct automation
- **Work Graph API** for v2 agent runtimes that record execution as a graph of work nodes
- **MCP over HTTP** at `/mcp` for Claude Code / Codex with OAuth login

### REST API

- Base path: `/api/tasks`
- Auth: `Authorization: Bearer <token>` for direct REST automation and legacy shell-helper flows
- Manage OAuth-backed agent installs from `/connections`

Bearer-token endpoints:

| Method   | Path                                 | Description                                                         |
| -------- | ------------------------------------ | ------------------------------------------------------------------- |
| `GET`    | `/api/tasks`                         | List tasks; filter by `status`, `engine`, `label`, or `project_key` |
| `POST`   | `/api/tasks`                         | Create a task                                                       |
| `GET`    | `/api/tasks/:id`                     | Get a task by task key or UUID                                      |
| `PATCH`  | `/api/tasks/:id`                     | Update a task                                                       |
| `DELETE` | `/api/tasks/:id`                     | Delete a task                                                       |
| `PATCH`  | `/api/tasks/:id/status`              | Update task workflow status                                         |
| `GET`    | `/api/projects`                      | List projects                                                       |
| `GET`    | `/api/projects/:projectKey/settings` | Get deploy and agent-instruction settings by project key            |
| `PATCH`  | `/api/qa-runs/:id`                   | Update a QA run                                                     |
| `GET`    | `/api/health`                        | Public health check                                                 |

Session-authenticated app endpoints include `/api/todos*`, `/api/events*`, `/api/settings`,
`/api/notifications`, `/api/projects*` write routes, `/api/work-logs*`,
`/api/project-backgrounds/*`, `/api/task-comments/*`, Telegram dispatch routes, project labels,
selected-ready QA triggers, and legacy `/api/api-keys*` compatibility routes. See
[`architecture.md`](architecture.md) for the complete internal route table.

Canonical workflow statuses are `inbox`, `todo`, `hold`, `ready`, `done`, and `archived`. Task payloads can also include execution fields `run_state` and `run_state_updated_at` so API clients can distinguish workflow position from live agent activity. Full task payloads include an `artifacts` array for persisted task outputs such as screenshots, videos, documents, and links; `POST /api/tasks`, `PATCH /api/tasks/:id`, and QA-run updates accept up to 50 artifact objects.

Task `repo` fields and project `repoUrl` fields accept GitHub repo references as `owner/repo` IDs, HTTPS URLs, or SSH clone URLs, for example `sonim1/preqstation`, `https://github.com/sonim1/preqstation`, or `git@github.com:sonim1/preqstation.git`. Write paths normalize accepted references to `owner/repo` before storage, matching, and responses; invalid or non-GitHub values still fail validation.

### Session Settings and Dispatch Payloads

Session-authenticated settings clients can update the global agent model catalog with
`PATCH /api/settings`:

```json
{
  "key": "agent_model_catalog",
  "value": "{\"claude-code\":[{\"label\":\"Claude Sonnet 4.6\",\"value\":\"claude-sonnet-4-6\"}],\"codex\":[{\"label\":\"gpt-5.5\",\"value\":\"gpt-5.5\"},{\"label\":\"gpt-5.4\",\"value\":\"gpt-5.4\"},{\"label\":\"gpt-5.4-mini\",\"value\":\"gpt-5.4-mini\"},{\"label\":\"gpt-5.3-codex\",\"value\":\"gpt-5.3-codex\"},{\"label\":\"gpt-5.3-codex-spark\",\"value\":\"gpt-5.3-codex-spark\"},{\"label\":\"gpt-5.2\",\"value\":\"gpt-5.2\"}],\"gemini-cli\":[]}"
}
```

`value` must be a JSON object keyed by `claude-code`, `codex`, and/or `gemini-cli`. Each engine
array may contain model ID strings or `{ "label": "...", "value": "..." }` objects. The API rejects
invalid JSON and normalizes accepted values before saving them in `user_settings.agent_model_catalog`.
Successful settings updates include the saved string as `value`; for the model catalog, this is the
normalized catalog string:

```json
{
  "ok": true,
  "value": "{\"claude-code\":[{\"label\":\"Claude Sonnet 4.6\",\"value\":\"claude-sonnet-4-6\"}],\"codex\":[{\"label\":\"gpt-5.5\",\"value\":\"gpt-5.5\"}],\"gemini-cli\":[]}"
}
```

When the setting is blank, the built-in Codex catalog includes `gpt-5.5`, `gpt-5.4`,
`gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`, and `gpt-5.2`. Codex model selectors show
the no-override option as `Default (gpt-5.5)`; other engines show `Default`.

Dispatch-related session APIs accept optional per-request `model` metadata:

| Endpoint                                 | Optional `model` behavior                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /api/tasks/:id/comments`           | Included in the outbound comment follow-up dispatch when the comment queues an agent run. |
| `POST /api/projects/:id/qa-runs/trigger` | Included in the outbound QA dispatch command for the selected ready task keys.            |

Blank, `default`, `__default__`, overlong, or invalid model values are omitted. Valid values are
added to the OpenClaw or Hermes dispatch command only for that dispatch request; they do not update
the task's saved engine or persist on the QA run record.

### Work Graph API (v2)

The work graph is the primary task view. Each task can hold a graph of typed work nodes that
records how an agent actually executed the task: planning, implementation, review, decisions,
waiting-for-user states, and attached evidence.

- Auth: `Authorization: Bearer <token>` or an owner session cookie
- Envelope: every response is `{ ok, schema_version, request_id, data, warnings }` on success or
  `{ ok: false, schema_version, request_id, error: { code, message, details } }` on failure
- `schema_version` is currently `preqstation.v2.0`. This versions the work graph wire contract and
  is independent of the npm package version.
- All mutations are written to the audit log with the acting token or session recorded

| Method  | Path                               | Description                                                                        |
| ------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`   | `/api/tasks/:id/work-graph`        | Get the full graph for a task (task key or UUID)                                   |
| `POST`  | `/api/tasks/:id/work-graph/init`   | Initialize the graph and its canonical root node                                   |
| `POST`  | `/api/tasks/:id/work-graph/nodes`  | Create a work node                                                                 |
| `POST`  | `/api/tasks/:id/work-graph/memory` | Append markdown to the task's shared workflow memory                               |
| `GET`   | `/api/work-nodes/:nodeId`          | Get one work node                                                                  |
| `PATCH` | `/api/work-nodes/:nodeId`          | Transition a node: `start`, `complete`, `fail`, `cancel`, `wait`, `block`, `ready` |
| `POST`  | `/api/work-nodes/:nodeId/evidence` | Attach evidence to a node                                                          |

Node `type` values: `root`, `plan`, `explore`, `analyze`, `research`, `interview`, `implement`,
`document`, `review`, `test`, `qa`, `deploy`, `decision`, `approval`, `blocked`, `proposal`,
`result`. Node `status` values: `pending`, `ready`, `running`, `waiting_for_user`, `blocked`,
`completed`, `failed`, `cancelled`. Evidence `kind` values: `command`, `test`, `log`,
`changed_file`, `screenshot`, `artifact`, `pull_request`, `deployment`, `summary`, `error`.

Node create accepts both camelCase and snake_case field names, optional `parentId`,
`dependencyIds`, `idempotencyKey` for safe retries, actor/engine/model attribution fields, and a
free-form `metadata` object. Node transition (`PATCH`) also accepts `resultSummary`,
`waitingReason`, `decisionPrompt`, and `metadata`.

Task notes stay attached to the canonical root node only; other nodes carry their own bodies,
result summaries, and evidence.

#### Workflow profile metadata

Harnesses record how they chose to run the work in the namespaced `metadata.workflow_profile`
object on work nodes. The default requested profile is `auto`: PreqStation Core never chooses or
executes a concrete workflow or skill; the harness decides and reports back.

```json
{
  "workflow_profile": {
    "requested": "auto",
    "manual_command": null,
    "resolved": "gstack-plan-eng-review",
    "resolved_command": "/plan-eng-review",
    "resolved_reason": "Architecture review needed before implementation"
  }
}
```

`requested` is required; `manual_command` must be `null` until a manual override UI exists;
`resolved`, `resolved_command`, and `resolved_reason` are optional and written by the harness after
it picks a workflow. See [`workflow-profile-contract.md`](workflow-profile-contract.md) for the
full contract and rationale.

#### Agent CLI

The core repo ships a `preqstation-agent` CLI that wraps the work graph API for detached agent
runs. The `preqstation` command remains owned by the dispatcher package (`@sonim1/preqstation`).
The agent CLI reads `PREQSTATION_API_URL` and `PREQSTATION_API_TOKEN` and emits the same JSON
envelope.

| Command                                                                                                                        | Description                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `preqstation-agent agent guide --json`                                                                                         | Discover runtime rules and the workflow profile contract |
| `preqstation-agent project resolve PREQ --json`                                                                                | Resolve a project mapping                                |
| `preqstation-agent context files PREQ --json` / `context doctor PREQ --json`                                                   | Inspect local context files                              |
| `preqstation-agent run prepare PREQ-123 --json`                                                                                | Fetch the task work graph before starting                |
| `preqstation-agent graph init PREQ-123 --json`                                                                                 | Initialize the graph                                     |
| `preqstation-agent graph state PREQ-123 --json`                                                                                | Read the graph                                           |
| `preqstation-agent graph node create PREQ-123 --type analyze --title "..." --metadata-file metadata.json --json`               | Create a node                                            |
| `preqstation-agent graph node start\|complete\|fail NODE-ID [--summary-file result.md] [--metadata-file metadata.json] --json` | Transition a node                                        |
| `preqstation-agent graph evidence attach NODE-ID ... --json`                                                                   | Attach evidence                                          |
| `preqstation-agent graph memory append PREQ-123 ... --json`                                                                    | Append workflow memory                                   |

`--metadata-file` points at a JSON file whose object is sent as node `metadata`, which is how
CLI-based harnesses record `workflow_profile`.

### MCP over HTTP

- Endpoint: `/mcp`
- Protected Resource Metadata: `/.well-known/oauth-protected-resource/mcp`
- Discovery challenge: unauthenticated `/mcp` requests return `WWW-Authenticate: Bearer realm="preqstation", resource_metadata="https://<your-domain>/.well-known/oauth-protected-resource/mcp"`
- Authorization Server Metadata: `/.well-known/oauth-authorization-server`
- Compatibility endpoints for path-aware MCP/OIDC discovery: `/.well-known/oauth-authorization-server/mcp`, `/.well-known/openid-configuration/mcp`, and `/mcp/.well-known/openid-configuration`
- Auth: OAuth authorization code flow with browser login
- Owner visibility: `/connections` shows client name, engine, status, last-used time, and expiry
- Claude Code install: `claude mcp add --transport http preqstation https://<your-domain>/mcp`
- Codex install: `codex mcp add preqstation --url https://<your-domain>/mcp`
- Exposed read tools include `preq_list_projects`, `preq_list_tasks`, `preq_list_project_activity`, `preq_get_task`, and `preq_get_project_settings`
- Work graph tools: `preq_agent_guide` (runtime rules plus the workflow profile contract), `preq_graph_state`, `preq_graph_node_create`, `preq_graph_node_update`, and `preq_graph_evidence_attach`. Node create and update accept the same `metadata` object as the REST routes, including `metadata.workflow_profile`.

#### `preq_list_project_activity`

Read-only project activity feed for sync jobs, status dashboards, and agents that need changes across tasks, task comments, and work logs without polling board snapshots.

Inputs:

| Field         | Required | Description                                                                                            |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `from`        | Yes      | ISO timestamp for the inclusive lower bound of the activity window.                                    |
| `to`          | Yes      | ISO timestamp for the exclusive upper bound of the activity window. Must be after `from`.              |
| `projectKeys` | No       | Up to 20 project keys to filter by. Keys are normalized to uppercase and must match existing projects. |
| `limit`       | No       | Page size from 1 to 500. Defaults to 500.                                                              |
| `cursor`      | No       | Opaque cursor returned as `next_cursor` from a previous page.                                          |

Pagination is ordered newest first by `occurred_at`, then `event_id`. When `has_more` is `true`, call the tool again with the same `from`, `to`, `projectKeys`, and `limit`, plus the returned `next_cursor`. Treat cursors as opaque strings; do not decode or edit them.

Response shape:

```json
{
  "from": "2026-05-12T10:00:00.000Z",
  "to": "2026-05-13T10:30:00.000Z",
  "project_keys": ["PQST"],
  "count": 3,
  "has_more": false,
  "next_cursor": null,
  "events": [
    {
      "event_id": "work_log:worklog-1:worked:2026-05-13T10:00:00.000Z",
      "type": "work_log.created",
      "occurred_at": "2026-05-13T10:00:00.000Z",
      "project_key": "PQST",
      "task_key": "PQST-113",
      "title": "PREQSTATION Result",
      "summary": "Completed implementation and opened PR",
      "source": "work_log",
      "task": {
        "id": "task-1",
        "task_key": "PQST-113",
        "title": "Fix labels",
        "status": "todo",
        "priority": "high",
        "branch_name": "task/pqst-113",
        "engine": "codex",
        "dispatch_target": "telegram",
        "run_state": null
      },
      "project": {
        "id": "project-1",
        "key": "PQST",
        "name": "PreqStation",
        "repoUrl": "sonim1/preqstation"
      }
    }
  ]
}
```

Activity `source` values are `task`, `task_comment`, and `work_log`. Current event `type` values are `task.created`, `task.updated`, `task_comment.created`, `task_comment.updated`, and `work_log.created`.

### Internal Notifications

The session-authenticated `/api/notifications` endpoint powers the in-app notification drawer.
`GET /api/notifications` returns a single `notifications` array that merges task-completion
notifications with connection-expiration notifications, sorted by newest `createdAt` first. It
accepts `history=1` or `history=true` for read notifications plus `offset` and `limit` pagination.

Task notifications return `type: "task"` with task key, title, status transition, read time, and
creation time. Connection-expiration notifications return `type: "connection-expiration"` with
`source: "mcp" | "browser"`, target details, `expiresAt`, read time, and creation time. Connection
expiration notices are generated for active MCP connections and browser sessions that expire within
three days; their read state is stored in `connection_notification_reads`.

`PATCH /api/notifications` accepts either `{ "notificationIds": [...] }` or `{ "markAll": true }`
and marks matching task and connection-expiration notifications as read for the current owner.

See [`architecture.md`](architecture.md) for the current API and workflow contract.

For first-time system onboarding, prefer:

- [PreqStation Guide](https://preqstation.com/guide) for the umbrella guide and recommended reading order
- [`preqstation-cli`](https://github.com/sonim1/preqstation-cli) for PREQ CLI operator-host setup, project mapping, and dispatch/direct-run workflows
- the `/mcp` OAuth install commands above when Claude Code or Codex should call PreqStation MCP tools directly
- [`preqstation-skill`](https://github.com/sonim1/preqstation-skill) only for deprecated legacy token-based worker bridges or shell-helper compatibility

---
