# Installation

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

# 5. Create or verify the owner account
# Fresh installs guide you through owner setup; see setup.md for manual setup details

# 6. Start the development server
npm run dev
```

The app runs at `http://localhost:3000` by default. Set `PORT=` in `.env.local` to change it.
`drizzle-kit` reads `DATABASE_URL` from `.env.local`.

### First-Run Onboarding

After the owner logs in for the first time, an empty workspace routes to `/onboarding`. The wizard
uses a worker-first sequence:

1. Create or confirm the first project.
2. Create the first task inside that project.
3. Connect a worker through MCP or an API token.

Dispatcher automation is optional. Use the dispatcher after the project, task, and worker path is
working; it is not required for the first successful setup.

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
Optional authenticator-app 2FA is enabled from **Settings -> Two-factor authentication** after the
owner can log in; setup stores `users.two_factor_enabled` plus an encrypted `users.two_factor_secret`.

---

## Development Commands

```bash
npm run dev          # Start dev server (reads PORT from .env.local)
npm run lint         # Run ESLint
npm run typecheck    # Run tsc --noEmit
npm run test:unit    # Run Vitest unit tests
npm run build        # Production build
npm run build:cloudflare   # Production build through OpenNext Cloudflare
npm run upload:cloudflare  # Upload the Cloudflare build without deploying
npm run deploy:cloudflare  # Build/upload/deploy through OpenNext Cloudflare
```

Additional database commands:

```bash
npm run db:generate  # Generate SQL migration files from schema changes
npm run db:migrate   # Apply checked-in migrations
npm run db:push      # Push schema directly to the configured database
npm run db:pull      # Pull schema state from the configured database
npm run db:studio    # Open Drizzle Studio
```
