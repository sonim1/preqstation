# Contributing to Preq Station

Thanks for your interest in contributing. Browse [open issues](https://github.com/sonim1/preqstation/issues) to find something to work on, or open a new issue before starting significant work.

---

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL

---

## Local Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/preqstation.git
cd preqstation

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — fill in AUTH_SECRET, DATABASE_URL, and optional settings

# 4. Run database migrations
npm run db:migrate

# 5. Provision the owner user in PostgreSQL
# See docs/setup.md for the bcrypt + SQL steps

# 6. Start the dev server
npm run dev
```

The app starts on `http://localhost:3000` by default. Set `PORT=` in `.env.local` to override.
`drizzle-kit` reads `DATABASE_URL` from `.env.local`.

---

## Development Workflow

**Branch naming**

| Type    | Pattern                     |
| ------- | --------------------------- |
| Feature | `feature/short-description` |
| Bug fix | `fix/short-description`     |
| Docs    | `docs/short-description`    |

**Typical flow**

1. Create a branch from `main`.
2. Make changes; keep commits focused and atomic.
3. Run `npm run lint && npm run typecheck && npm run test:unit` locally before pushing.
4. Open a pull request targeting `main`.

---

## Code Style

ESLint and Prettier are enforced automatically on every commit via Husky + lint-staged.

- **On commit**: `eslint --fix` + `prettier --write` run on staged `.ts`/`.tsx` files; `prettier --write` runs on `.json`, `.md`, and `.css`.
- **ESLint rules**: sorted imports (`simple-import-sort`), no unused imports (`unused-imports`), Next.js recommended rules.
- **TypeScript**: strict mode (`tsc --noEmit` must pass).

To format manually:

```bash
npm run lint          # check + auto-fix ESLint issues
npm run format        # format all files with Prettier
npm run typecheck     # type-check without emitting
```

---

## Testing

Unit tests use [Vitest](https://vitest.dev).

```bash
npm run test:unit        # run all unit tests once
npm run test:unit:watch  # watch mode
```

**Conventions**

- Place test files under `tests/` or co-located as `*.test.ts` / `*.test.tsx`.
- Name tests descriptively: `describe('feature') > it('does X when Y')`.
- Cover edge cases and error paths, not just the happy path.

---

## CI Pipeline

GitHub Actions runs on every push and pull request to `main`:

| Step       | Command             |
| ---------- | ------------------- |
| Lint       | `npm run lint`      |
| Typecheck  | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| Build      | `npm run build`     |

All steps must pass before a PR can be merged.

---

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org):

```
type(scope): short description
```

**Types**

| Type       | When to use                         |
| ---------- | ----------------------------------- |
| `feat`     | New feature                         |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `test`     | Adding or updating tests            |
| `ci`       | CI/CD configuration                 |
| `refactor` | Code change with no behavior change |
| `chore`    | Tooling, deps, config               |

Examples: `feat(kanban): add drag-and-drop reordering`, `fix(auth): handle expired session cookie`

---

## Pull Request Guidelines

- Link the related issue in the PR description (`Closes #123`).
- Keep each PR focused on one concern.
- Fill in the PR description template — what changed and why.
- Ensure CI is green before requesting review.
- Prefer small, reviewable PRs over large all-in-one changes.

---

## Code of Conduct

Be respectful and constructive. Critique ideas, not people. Everyone contributing here is expected to foster an inclusive and welcoming environment.
