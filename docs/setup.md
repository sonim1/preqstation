# Setup Guide

## 1) Connect GitHub Remote

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git add .
git commit -m "chore: bootstrap preqstation"
git push -u origin main
```

## 2) Provision PostgreSQL

1. Create a PostgreSQL database in your managed service of choice.
2. Copy the connection string.
3. If you changed the schema locally, generate Drizzle migration files.

```bash
npm run db:generate
```

## 3) Apply Migrations

`drizzle-kit` reads `DATABASE_URL` from `.env.local`. Copy `.env.example` to `.env.local` before running DB commands.

### New DB (first-time setup)

```bash
npm run db:migrate
```

### Existing DB (if the schema was applied manually)

1. Make sure your database state matches the checked-in Drizzle migrations.

2. Then apply the migrations from the repo.

```bash
npm run db:migrate
```

## 4) Connect Vercel

1. Import the GitHub repo in Vercel.
2. Framework: Next.js (auto-detected).
3. Node.js: use Vercel default latest LTS.

### Required Environment Variables

Set these in both Production and Preview:

| Variable          | Description                        | Example                       |
| ----------------- | ---------------------------------- | ----------------------------- |
| `AUTH_SECRET`     | HMAC session secret (min 32 bytes) | `openssl rand -base64 48`     |
| `DATABASE_URL`    | PostgreSQL connection string       |                               |
| `ALLOWED_ORIGINS` | Comma-separated origin allowlist   | `https://your-app.vercel.app` |

### Optional Deployment Variables

| Variable             | Description                                                                                 | Default |
| -------------------- | ------------------------------------------------------------------------------------------- | ------- |
| `MIGRATE_ON_PREVIEW` | Set to `true` only when Preview deployments use an isolated database and should run Drizzle | unset   |

This repo configures Vercel to run `node scripts/vercel-build.mjs` for deployments. That script:

- runs `npm run db:migrate` automatically for `production`
- skips migrations for `preview` by default
- allows preview migrations only when `MIGRATE_ON_PREVIEW=true`

Skipping preview migrations by default is intentional. A shared Preview/Production database can be advanced by a preview deploy before the production code is live.

Recommended Vercel setup:

- Production env: set `DATABASE_URL` to the production database
- Preview env: set `DATABASE_URL` to the preview database
- Preview env: set `MIGRATE_ON_PREVIEW=true` once that preview database is ready to receive migrations

## 5) Provision the Owner User

Owner credentials now live in PostgreSQL, not env vars.
Generate a bcrypt hash locally, then update or insert the owner row.

Generate a hash:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash(process.argv[1], 10).then(console.log)" 'replace-with-strong-password'
```

Existing deployment with data already linked to the current owner row:

```sql
UPDATE users
SET email = 'you@example.com',
    password_hash = '$2b$10$replace_me',
    is_owner = true,
    updated_at = NOW()
WHERE is_owner = true;
```

Fresh database with no owner row yet:

```sql
INSERT INTO users (email, password_hash, is_owner)
VALUES ('you@example.com', '$2b$10$replace_me', true);
```

If you are migrating an existing instance, keep the existing owner row `id` so projects, tasks, API tokens, and work logs stay linked automatically.

## 6) Configure Telegram Channels

Open **Settings → Telegram** after the owner account is provisioned. Telegram configuration is now
split by dispatch target:

- **Bot Token**: one shared bot token for all Telegram sends
- **OpenClaw Chat ID** + **Enable OpenClaw Telegram messaging**: used for default task sends,
  OpenClaw `/status`, and any QA or project insight sends that target `telegram`
- **Hermes Chat ID** + **Enable Hermes Telegram messaging**: used for Hermes-targeted task sends
  plus any QA or project insight sends that target `hermes-telegram`

Operational notes:

- If you save only the OpenClaw channel, default Telegram task sends plus Telegram-targeted QA and
  project insight actions continue to work.
- If you enable Hermes, task sends plus QA and project insight actions that target
  `hermes-telegram` use the Hermes chat instead of the OpenClaw chat.
- QA runs and project insight actions dispatch only through the enabled Telegram targets shown in
  their modals; there is no in-app `Channels` fallback for those flows.
- Older installs can still fall back to the legacy single-channel settings
  (`telegram_chat_id` / `telegram_enabled`) until the split channel settings are saved.

Validation rules:

- Saving settings fails if OpenClaw is enabled without an OpenClaw Chat ID, Hermes is enabled
  without a Hermes Chat ID, or either channel is enabled without a Bot Token.
- The test buttons require the selected channel Chat ID plus either a newly entered Bot Token or a
  previously saved Bot Token.
- The project insight modal can expose `🦞 Telegram` and/or `H Telegram`, depending on which
  Telegram channels are enabled. If neither channel is enabled, dispatch stays unavailable.
- The QA modal can expose `🦞 Telegram` and/or `H Telegram`, depending on which Telegram channels
  are enabled. If neither channel is enabled, QA dispatch stays unavailable.

Recommended validation from the settings screen:

- Save the Bot Token plus the OpenClaw and/or Hermes Chat IDs you plan to enable
- Send an **OpenClaw Test**
- Send **OpenClaw /status**
- Send a **Hermes Test** if Hermes messaging is enabled
- Open **Create Inbox Tasks from Insight** and confirm the expected target chips appear for your
  enabled channels
- Open **QA Runs** and confirm it can queue through `🦞 Telegram` and/or `H Telegram` as expected

## 7) Post-Deploy Validation

- `/api/health` returns `200`
- Owner email + password login succeeds using the `users` table row
- Invalid credentials are blocked
- Unauthenticated access to `/` redirects to `/login`
- Cross-origin requests to protected APIs return `403 Invalid origin`
- Burst abuse returns `429 Too many requests`
- `/api/projects` and `/api/todos` are owner-only
- Dashboard integration URL save, log creation, and status updates work
- Board columns show `Hold` and `Ready`
- OpenClaw Telegram test, OpenClaw `/status`, and Hermes Telegram test succeed for the channels you enabled
- Tasks dispatched to Telegram can surface `Requested` / `Running` execution badges
- Hermes-targeted task sends plus Hermes-targeted project insight sends land in the Hermes chat
- QA runs can queue through `🦞 Telegram` and/or `H Telegram`, and project insight dispatch uses
  the enabled Telegram target chips shown in the modal
- `claude mcp add --transport http .../mcp` or `codex mcp add ... --url .../mcp` completes browser login successfully

## 8) Offline Workspace Validation

Run this after any deploy that changes board shell code, `/sw.js`, or the offline mutation flow.

- Visit `/board` and `/projects` online at least once so the browser registers `/sw.js` and warms
  the workspace navigation cache. Also open each `/board/:projectKey` route you expect to use
  offline once while online so `OfflineBoardRouteWarmer` stores that board document in
  `preq-board-v2`.
- Disable network in the browser/devtools, reload `/board`, and confirm the offline banner appears
  and the most recent board snapshot renders.
- While still offline, reload a `/board/:projectKey` route that was visited online earlier and
  confirm the same offline banner and latest snapshot render there too.
- While still offline, open `/projects` and confirm the app shows the English offline fallback page
  instead of the browser's localized network error screen.
- While still offline, open a board path that has not been cached yet and confirm the app shows the
  board-specific English offline fallback page instead of the browser's network error screen.
- While still offline, quick-add a task, edit its title/note, and move it to another lane. Reload
  once to confirm the snapshot and task draft survive a refresh from IndexedDB.
- Re-enable network and confirm the queued create/edit/move mutations replay automatically, the
  optimistic `OFFLINE-*` task key is replaced with the server task key, and the task remains in the
  expected lane.
- If replay hits a note-conflict `409`, confirm the conflicting patch is removed from the queue,
  the latest server task title/notes are restored in the board/task editor, and the inline draft
  warning still offers `Restore draft` so the user can reconcile their offline notes manually.
- If replay hits another permanent validation/not-found/conflict error (`400`, `404`, `410`,
  `422`, or a `409` without refreshed task payloads), confirm that mutation is dropped, later
  queued mutations continue syncing, and the user still sees the returned error message. Transient
  failures should still halt replay with the remaining queue left in place for retry.

## 9) Least-Privilege DB Access

- Create a dedicated DB user for the app.
- Grant only required schema/table privileges.

## 10) PREQSTATION Agent Setup

Recommended MCP setup:

```bash
claude mcp add --transport http preqstation https://your-pm-domain.vercel.app/mcp
codex mcp add preqstation --url https://your-pm-domain.vercel.app/mcp
```

The client should open a browser window and complete OAuth login automatically.
After the flow completes, confirm the client appears on `/connections`.

Optional shell helper setup:

If you already maintain a legacy bearer token for shell-helper automation, set local environment variables for your agent runtime:

```bash
export PREQSTATION_API_URL="https://your-pm-domain.vercel.app"
export PREQSTATION_TOKEN="preq_xxxxxxxxxxxxxxxxx"
```

The API now separates workflow status from execution state:

- Workflow status: `inbox`, `todo`, `hold`, `ready`, `done`, `archived`
- Execution state: `queued`, `running`, or `null`

Install the skill package:

```bash
npx skills add sonim1/preqstation-skill -g
```

## 11) Operational Recommendations

- Rotate `AUTH_SECRET` and the stored owner `password_hash` regularly.
- Enable Vercel Access Logs and error alerting (e.g., Sentry).
- Enable Dependabot and patch dependencies at least monthly.
- Separate Vercel env vars for Production and Preview environments.
- Treat service worker changes as deploy-sensitive: load the updated `/board`, representative
  `/board/:key` routes, and `/projects` online once before relying on offline fallback for that
  browser profile.
- Offline workspace support depends on browser service worker + IndexedDB availability. Private
  browsing policies, cleared site storage, or corporate browser restrictions can disable the cached
  board path or custom offline fallback even when the server is healthy.
