# Project Structure

```
.
├── app/              # Next.js App Router pages and API routes
├── lib/              # Shared utilities, auth, DB client, validation
├── drizzle/          # SQL migrations + Drizzle metadata
├── tests/            # Vitest unit tests
├── docs/             # Setup, architecture, design-system, and implementation notes
└── public/           # Static assets
```

Key design-system entry points:

- `DESIGN.md` - product context and canonical design contract
- `docs/design-system.md` - contributor-facing UI implementation guide
- `app/globals.css` - semantic `--ui-*` token contract
- `app/providers.tsx` - Mantine theme bridge

---
