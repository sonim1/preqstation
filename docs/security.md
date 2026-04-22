# Security Design (Owner-Only)

## Goals

- Only one owner account can access the service.
- Defense is enforced at both app and database layers.

## 1) Authentication

- Login validates the single owner against `users.email` + `users.password_hash`.
- Session cookie settings: `httpOnly`, `sameSite=strict`, `secure` in production.
- Cookies are signed with HMAC (`AUTH_SECRET`) to prevent tampering.
- `/mcp` uses OAuth authorization code flow with PKCE and bearer access tokens.

## 2) Authorization

- `middleware.ts` checks all requests except public login, health, and OAuth discovery routes.
- Missing/invalid owner session redirects to `/login`.
- Rate limiting is applied to auth and protected APIs (`429`).

## 3) Database Security

- PostgreSQL is the final authorization layer. Row level security (RLS) is enabled on every application table in the schema.
- Owner-scoped requests execute inside `withOwnerDb(ownerId, ...)`, which opens a transaction and sets `app.user_id` before any reads or writes.
- Policies are keyed off `owner_id` (or equivalent ownership joins) so authenticated CRUD only sees rows owned by the current session/API token owner.
- `FORCE ROW LEVEL SECURITY` is applied to the main owner-scoped tables so policies stay active even if future code accidentally reaches for broader access.
- `users` allows read/update only for the current owner row.
- `security_events` is written through an explicit admin path and only exposes owner-visible rows back to the app.
- `is_owner=true` is constrained to exactly one row via a unique index.

### Access Modes

- `withOwnerDb(ownerId, ...)` is the default path for authenticated pages, server actions, REST APIs, MCP-authenticated flows, and task/project helpers.
- `withAdminDb(...)` is reserved for trusted bootstrap or security-sensitive paths that must bypass owner policies intentionally: login, OAuth code/token issuance, token hashing/lookup, and unauthenticated security-event logging.
- Ambient `db` usage is limited to trusted admin helpers and maintenance code. New authenticated features should thread the scoped client instead of importing `db` directly.

## 4) API Token Security

- Bearer tokens for external agents use `preq_` prefix.
- Tokens are SHA-256 hashed before storage (only the hash is persisted).
- Tokens remain available as a legacy compatibility path for direct REST automation, scoped to the issuing owner with optional expiration.
- Revoked tokens are soft-deleted (`revoked_at` timestamp).

## 4.5) MCP OAuth Security

- OAuth client registrations are stored in `oauth_clients`.
- OAuth authorization codes are stored in `oauth_codes`, tied to the registered client, and bound to the PKCE challenge + redirect URI.
- Active MCP installs are tracked in `mcp_connections` with display name, inferred engine, status, last-used timestamp, and expiry.
- MCP access tokens are signed bearer tokens scoped to the authenticated owner and a specific `connectionId`.
- `/mcp` verifies the bearer token and then loads the stored connection on every request so revoked or expired installs are rejected immediately.

## 5) Telegram Integration Security

- Bot token encrypted with AES-GCM (Web Crypto API + HKDF from `AUTH_SECRET`).
- Stored as `v1.{base64urlIV}.{base64urlCiphertext}` in `user_settings`.
- Messages sent via `/api/telegram/send` with audit logging.

## 6) Rate Limiting

### Current Implementation

- In-memory `Map` stores request counts per IP using a fixed-window algorithm.
- Applied to `/login` (POST only) and all `/api/` routes.
- Limits: 10 req/min per IP for auth, 120 req/min per IP for API routes.

### Serverless Limitation

> In Vercel serverless functions, each invocation may run in a different container.
> The in-memory `Map` is not shared across containers, making the rate limiter
> effective only within a single container's lifetime.

### Mitigation

- Acceptable for low-traffic owner-only deployments (current approach).
- For exposed API tokens: consider adding Redis-based limiting (Upstash).

## 7) Audit Trail

| Table             | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `audit_logs`      | Immutable record of all API mutations           |
| `security_events` | Login attempts, auth failures                   |
| `work_logs`       | Agent execution results with engine attribution |
| `events_outbox`   | Event sourcing for downstream processing        |

## 8) Operational Checklist

- Separate Vercel env vars for Production and Preview.
- `AUTH_SECRET` must be at least 16 characters (runtime-validated via Zod).
- Use a strong owner password and rotate the stored `password_hash` regularly.
- Update dependencies at least monthly.
- Consider IP allowlist via Cloudflare/Vercel protection layers.
