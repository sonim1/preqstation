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
- Discovery: `/.well-known/oauth-authorization-server`
- Auth: OAuth authorization code flow with browser login
- Owner visibility: `/connections` shows client name, engine, status, last-used time, and expiry
- Claude Code install: `claude mcp add --transport http preqstation https://<your-domain>/mcp`
- Codex install: `codex mcp add preqstation --url https://<your-domain>/mcp`
- Exposed read tools include `preq_list_projects`, `preq_list_tasks`, `preq_get_task`, and `preq_get_project_settings`

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
