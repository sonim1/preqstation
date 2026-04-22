# Preq Station

**AI Command Center for developers**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org)

---

## What is Preq Station

Preq Station is the core app and system of record in the PREQSTATION stack. It provides the Kanban board, task lifecycle, work logging, and the PREQSTATION API/MCP surfaces that coding agents use to read and update tasks programmatically.

PREQSTATION as a whole is a multi-surface system:

- `preqstation` — core app, task lifecycle, API, architecture
- `preqstation-dispatcher` — optional dispatcher path that launches coding agents in isolated worktrees
- `preqstation-skill` — worker/runtime setup for Claude Code, Codex, and Gemini
- `preqstation-lp` — umbrella onboarding and public guide

If you are new to the system, start with the landing/guide surface first, then return here for the core app and architecture details.

---

## Features

- **Projects** — create and manage projects with GitHub/Vercel URL tracking
- **Kanban board** — drag-and-drop task management across 6 workflow statuses (`inbox`, `todo`, `hold`, `ready`, `done`, `archived`)
- **Execution overlay** — task cards can show `Requested` / `Running` independently from workflow position
- **PREQSTATION Task API** — REST API at `/api/tasks` for AI agent integration with Bearer token auth
- **Connections** — review and revoke OAuth/MCP clients from `/connections`
- **Command Palette** — keyboard-driven navigation via Mantine Spotlight
- **Today Focus** — pin tasks to surface daily priorities
- **Activity tracking** — work logs linked to projects and tasks
- **Audit logs** — immutable record of all mutations
- **Security events** — login allow/deny and authorization failure logging

---

## Tech Stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Framework  | Next.js 16                        |
| UI         | React 19, Mantine 8, Tabler Icons |
| Charts     | Recharts, @mantine/charts         |
| ORM        | Drizzle ORM                       |
| Database   | PostgreSQL                        |
| Validation | Zod                               |
| Editor     | Lexical                           |
| Testing    | Vitest, Playwright                |
| Language   | TypeScript 5                      |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/sonim1/preqstation.git
cd preqstation

# 2. Copy and fill environment variables
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Apply database migrations
npm run db:migrate

# 5. Provision the owner user in PostgreSQL
# See docs/setup.md for the bcrypt + SQL steps

# 6. Start the development server
npm run dev
```

The app runs at `http://localhost:3000` by default. Set `PORT=` in `.env.local` to change it.
`drizzle-kit` reads `DATABASE_URL` from `.env.local`.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values before starting.

| Variable          | Required | Description                                                                  |
| ----------------- | -------- | ---------------------------------------------------------------------------- |
| `AUTH_SECRET`     | Yes      | HMAC session signing secret (min 16 chars). Generate: `openssl rand -hex 32` |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string                                                 |
| `ALLOWED_ORIGINS` | No       | Comma-separated origins for CORS/server action checks                        |

Owner credentials are no longer read from env vars. Store them in the `users` table as
`email` + `password_hash`, keeping the existing owner row `id` when migrating an existing instance.

---

## Development

```bash
npm run dev          # Start dev server (reads PORT from .env.local)
npm run lint         # Run ESLint
npm run typecheck    # Run tsc --noEmit
npm run test:unit    # Run Vitest unit tests
npm run build        # Production build
```

Additional database commands:

```bash
npm run db:generate  # Generate SQL migration files from schema changes
npm run db:migrate   # Apply checked-in migrations
npm run db:push      # Push schema directly to the configured database
npm run db:pull      # Pull schema state from the configured database
npm run db:studio    # Open Drizzle Studio
```

---

## Project Structure

```
.
├── app/              # Next.js App Router pages and API routes
├── lib/              # Shared utilities, auth, DB client, validation
├── drizzle/          # SQL migrations + Drizzle metadata
├── tests/            # Vitest unit tests
├── docs/             # Setup, architecture, and implementation notes
└── public/           # Static assets
```

---

## API

Preq Station exposes two agent integration surfaces.

- **REST API** for shell helpers and direct automation
- **MCP over HTTP** at `/mcp` for Claude Code / Codex with OAuth login

### REST API

- Base path: `/api/tasks`
- Auth: `Authorization: Bearer <api-token>` for direct REST automation and legacy shell-helper flows
- Manage OAuth-backed agent installs from `/connections`

Endpoints:

| Method   | Path             | Description                                  |
| -------- | ---------------- | -------------------------------------------- |
| `GET`    | `/api/tasks`     | List tasks (filter by status, label, engine) |
| `POST`   | `/api/tasks`     | Create a task                                |
| `PATCH`  | `/api/tasks/:id` | Update a task                                |
| `DELETE` | `/api/tasks/:id` | Delete a task                                |

Canonical workflow statuses are `inbox`, `todo`, `hold`, `ready`, `done`, and `archived`. Task payloads can also include execution fields `run_state` and `run_state_updated_at` so API clients can distinguish workflow position from live agent activity.

### MCP over HTTP

- Endpoint: `/mcp`
- Discovery: `/.well-known/oauth-authorization-server`
- Auth: OAuth authorization code flow with browser login
- Owner visibility: `/connections` shows client name, engine, status, last-used time, and expiry
- Claude Code install: `claude mcp add --transport http preqstation https://<your-domain>/mcp`
- Codex install: `codex mcp add preqstation --url https://<your-domain>/mcp`
- Exposed read tools include `preq_list_projects`, `preq_list_tasks`, `preq_get_task`, and `preq_get_project_settings`

See [`docs/architecture.md`](docs/architecture.md) for the current API and workflow contract.

For first-time system onboarding, prefer:

- `preqstation-lp` for the umbrella guide and recommended reading order
- `preqstation-skill` for worker/runtime setup
- `preqstation-dispatcher` for the optional dispatcher path

---

## Security

Preq Station is designed for a single owner. All routes require authentication and all data is scoped to that owner at the database level in PostgreSQL.

Key policies:

- Session cookies are `httpOnly`, `sameSite=strict`, signed with HMAC
- Login verifies the single owner against the `users` table
- Row level security is enabled across the app schema and owner-scoped requests set `app.user_id` before querying
- Authenticated pages, server actions, and APIs use `withOwnerDb(ownerId, ...)` instead of ambient access to the global `db`
- Bootstrap/login/OAuth flows and security-event writes use explicit admin access via `withAdminDb(...)`
- `/mcp` uses OAuth discovery + bearer access tokens instead of raw API keys
- Middleware enforces authentication on every route except public health/login/OAuth discovery routes
- Rate limiting is applied to auth and protected API routes
- Mutating APIs enforce same-origin verification
- Login and authorization failures are recorded in `security_events`

See [`docs/security.md`](docs/security.md) for the full security design.

---

## License

MIT — see [LICENSE](LICENSE).
