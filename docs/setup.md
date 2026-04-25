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

## 6) Post-Deploy Validation

- `/api/health` returns `200`
- Owner email + password login succeeds using the `users` table row
- Invalid credentials are blocked
- Unauthenticated access to `/` redirects to `/login`
- Cross-origin requests to protected APIs return `403 Invalid origin`
- Burst abuse returns `429 Too many requests`
- `/api/projects` and `/api/todos` are owner-only
- Dashboard integration URL save, log creation, and status updates work
- Board columns show `Hold` and `Ready`
- Tasks dispatched to Telegram can surface `Requested` / `Running` execution badges
- `claude mcp add --transport http .../mcp` or `codex mcp add ... --url .../mcp` completes browser login successfully

## 7) Offline Board Validation

Run this after any deploy that changes board shell code, `/sw.js`, or the offline mutation flow.

- Visit `/board` online at least once so the browser registers `/sw.js` and warms the board cache.
- Disable network in the browser/devtools, reload `/board`, and confirm the offline banner appears
  and the most recent board snapshot renders.
- While still offline, quick-add a task, edit its title/note, and move it to another lane. Reload
  once to confirm the snapshot and task draft survive a refresh from IndexedDB.
- Re-enable network and confirm the queued create/edit/move mutations replay automatically, the
  optimistic `OFFLINE-*` task key is replaced with the server task key, and the task remains in the
  expected lane.
- If replay hits a permanent validation/not-found/conflict error (`400`, `404`, `409`, `410`,
  `422`), confirm that mutation is dropped, later queued mutations continue syncing, and the user
  still sees the returned error message. Transient failures should still halt replay with the
  remaining queue left in place for retry.

## 8) Least-Privilege DB Access

- Create a dedicated DB user for the app.
- Grant only required schema/table privileges.

## 9) PREQSTATION Agent Setup

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

## 10) Operational Recommendations

- Rotate `AUTH_SECRET` and the stored owner `password_hash` regularly.
- Enable Vercel Access Logs and error alerting (e.g., Sentry).
- Enable Dependabot and patch dependencies at least monthly.
- Separate Vercel env vars for Production and Preview environments.
- Treat service worker changes as deploy-sensitive: load the updated `/board` online once before
  relying on offline fallback for that browser profile.
- Offline board support depends on browser service worker + IndexedDB availability. Private browsing
  policies, cleared site storage, or corporate browser restrictions can disable the cached board
  path even when the server is healthy.
