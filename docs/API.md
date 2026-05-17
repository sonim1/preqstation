# API

PreqStation exposes two agent integration surfaces.

- **REST API** for shell helpers and direct automation
- **MCP over HTTP** at `/mcp` for Claude Code / Codex with OAuth login

### REST API

- Base path: `/api/tasks`
- Auth: `Authorization: Bearer <token>` for direct REST automation and legacy shell-helper flows
- Manage OAuth-backed agent installs from `/connections`

Endpoints:

| Method   | Path             | Description                                  |
| -------- | ---------------- | -------------------------------------------- |
| `GET`    | `/api/tasks`     | List tasks (filter by status, label, engine) |
| `POST`   | `/api/tasks`     | Create a task                                |
| `PATCH`  | `/api/tasks/:id` | Update a task                                |
| `DELETE` | `/api/tasks/:id` | Delete a task                                |

Canonical workflow statuses are `inbox`, `todo`, `hold`, `ready`, `done`, and `archived`. Task payloads can also include execution fields `run_state` and `run_state_updated_at` so API clients can distinguish workflow position from live agent activity. Full task payloads include an `artifacts` array for persisted task outputs such as screenshots, videos, documents, and links; `POST /api/tasks`, `PATCH /api/tasks/:id`, and QA-run updates accept up to 50 artifact objects.

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
- [`preqstation-skill`](https://github.com/sonim1/preqstation-skill) for worker/runtime setup
- [`preqstation-dispatcher`](https://github.com/sonim1/preqstation-dispatcher) for PREQ CLI setup and dispatcher automation

---
