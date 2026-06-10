# Design System - Preq Station

## Product Context

- **What this is:** PreqStation is an owner-only command center for one developer operating projects, tasks, work logs, agent dispatch, QA runs, and connected clients.
- **Primary user:** The owner/operator. The UI should optimize for repeated daily scanning, quick task triage, and confident execution controls.
- **Core surfaces:** Dashboard, board, project roster, project detail, task editor, settings, API keys, connections, notifications, and onboarding.
- **Product stance:** Authenticated product UI, not marketing. Density, reliable state, and fast recovery matter more than brand flourish.

## Aesthetic Direction

- **Direction:** Calm operator desk.
- **Mood:** Focused, technical, compact, and low-noise. The product should feel like a control room for one capable operator, not a generic SaaS dashboard.
- **Current baseline:** Dark mode is the default, blue is the brand/action color, Mantine is the component base, and the global `--ui-*` token layer owns app semantics.
- **Decoration level:** Functional polish only. Use quiet gradients, subtle depth, blurred modal chrome, and small state signals when they improve scanning or clarify execution state.
- **Avoid:** Decorative hero sections, stock imagery, generic warm canvas treatments, emoji as status UI, and one-off colors that bypass the token contract.

## Implementation Snapshot

- `app/providers.tsx` defines the Mantine bridge: brand scale, Pretendard-first font stack, `md` default radius, auto contrast, and dark default color scheme.
- `app/theme-config.ts` sets `DEFAULT_COLOR_SCHEME = 'dark'` and the `preqstation-color-scheme` storage key.
- `app/globals.css` is the canonical app token and shared chrome layer. It defines base surfaces, state colors, table/security/admin/workspace/dashboard/board/modal tokens, global focus, body backgrounds, and Mantine overrides.
- CSS modules own surface-specific mechanics: card radius, heatmap cell sizing, editor layout, modal resizing, and page-specific grids.
- Tests assert the design contract in `tests/theme-token-usage.test.ts`, `tests/board-frame-token-contract.test.ts`, `tests/dashboard-token-contract.test.ts`, and related surface tests. Treat those tests as documentation for token intent.

## Typography

- **Application font:** Pretendard with `Inter`, `SF Pro Text`, and system sans-serif fallbacks, configured in `app/providers.tsx`.
- **Headings:** Pretendard with `Inter`, `SF Pro Display`, and system sans-serif fallbacks.
- **Wordmark:** `.brand-wordmark` is uppercase with slight positive tracking; `.font-brand` uses the display/system stack in `app/globals.css`.
- **Data and code:** Use monospace for task keys, commands, logs, snippets, token values, timestamps, and compact chart labels.
- **Scale:** Use the Linear-inspired product type scale: 10, 12, 13, 14, 15, 17, 20, 24, and 36px equivalents. The default routine UI size is 15px (`--ui-font-size-regular`), with 13-14px for dense controls and metadata.
- **Headings:** Keep authenticated-product headings restrained: 20px for panel titles, 24px for page-level section titles, and 36px only for primary dashboard/route hero titles.
- **Rule:** Do not introduce a second display face inside the authenticated app.

## Color

- **Approach:** Dark-first neutral surfaces with a blue action scale and semantic state colors.
- **Primary brand:** `#274dc4` in light mode and `#3e6ae1` in dark mode via `--ui-accent`.
- **Primary strong:** `#1f3ea0` in light mode and `#365fcd` in dark mode via `--ui-accent-strong`.
- **Foreground:** Use `--ui-text`, `--ui-muted-text`, and `--ui-on-accent`.
- **State:** Use `--ui-success`, `--ui-danger`, `--ui-warning`, `--ui-neutral-strong`, and their soft variants.
- **Workflow state:** Use `--ui-workflow-status-*` for task lifecycle indicators and `--ui-workflow-*` for dashboard workflow charts.
- **Execution state:** Use `--ui-status-queued`, `--ui-status-running`, and related foreground, border, soft, and glow tokens for agent run state.
- **Rule:** Redesign surfaces for both schemes. Do not rely on automatic inversion from light mode.

## Token Contract

Canonical tokens live in `app/globals.css`. Treat `--ui-*` variables as the app-level semantic layer:

- **Base surfaces:** `--ui-surface`, `--ui-surface-soft`, `--ui-surface-strong`, `--ui-body-surface`, `--ui-body-background`.
- **Reading surfaces:** `--ui-reading-surface`, `--ui-reading-surface-soft`, `--ui-reading-border`, `--ui-reading-code-border`.
- **Panel/card surfaces:** `--ui-card-bg`, `--ui-hero-bg`, `--ui-surface-panel`, `--ui-surface-panel-strong`, `--ui-surface-muted`, `--ui-surface-muted-strong`, `--ui-surface-elevated`, `--ui-surface-elevated-strong`.
- **Modal surfaces:** `--ui-surface-modal`, `--ui-surface-modal-header`, `--ui-surface-modal-body`.
- **Table surfaces:** `--ui-table-surface`, `--ui-table-border`, `--ui-table-header-surface`, `--ui-table-row-border`, `--ui-table-row-hover`, `--ui-table-row-selected`, `--ui-table-card-surface`, `--ui-table-card-border`.
- **Workspace chrome:** `--ui-workspace-control-surface`, `--ui-workspace-control-hover-surface`, `--ui-workspace-popover-surface`, `--ui-workspace-control-border`, `--ui-workspace-accent-surface`, `--ui-workspace-accent-border`, `--ui-workspace-control-shadow`, `--ui-workspace-popover-shadow`.
- **Admin/security:** `--ui-admin-*` tokens for settings and forms; `--ui-security-*` tokens for API keys, connections, alerts, and destructive/security actions.
- **Text:** `--ui-text`, `--ui-muted-text`, `--ui-on-accent`, `--ui-on-danger`.
- **Type scale:** `--ui-font-size-tiny`, `--ui-font-size-micro`, `--ui-font-size-mini`, `--ui-font-size-small`, `--ui-font-size-regular`, `--ui-font-size-large`, `--ui-font-size-title-3`, `--ui-font-size-title-2`, `--ui-font-size-title-1`, and shared `--ui-line-height-*` aliases.
- **Accent:** `--ui-accent`, `--ui-accent-strong`, `--ui-accent-soft`.
- **State:** `--ui-success`, `--ui-danger`, `--ui-warning`, `--ui-neutral-strong` and soft variants.
- **Workflow:** `--ui-workflow-status-inbox`, `--ui-workflow-status-todo`, `--ui-workflow-status-hold`, `--ui-workflow-status-ready`, `--ui-workflow-status-done`, `--ui-workflow-status-archived`.
- **Execution:** `--ui-status-queued`, `--ui-status-running`, and related foreground, border, soft, and glow tokens.
- **Interaction:** `--ui-focus-ring`, `--ui-hit-min`, `--ui-hit-touch-min`, `--ui-control-sm`, `--ui-control-md`.
- **Depth:** `--ui-border`, `--ui-shadow`, `--ui-elevation-0`, `--ui-elevation-1`, `--ui-elevation-2`, `--ui-elevation-3`.
- **Dashboard:** `--ui-dashboard-seam`, `--ui-dashboard-seam-fade`, `--ui-dashboard-chart-*`, `--ui-workload-level-*`, and `--ui-on-workload-level-*`.
- **Board frame:** `--kanban-frame-*`, `--kanban-stage-surface`, `--kanban-card-surface`, and kanban card shadow tokens.

Component-local variables are allowed when they describe one surface's mechanics, such as `--kanban-card-radius`, `--heatmap-cell-size`, `--button-height`, or modal resize dimensions. Promote a value to `--ui-*` only when multiple surfaces need the same semantic color, surface, focus, or elevation.

## Surface Rules

- **Workspace shell:** Header, sidebar, command palette trigger, board picker, account menu, and mobile project picker should use `--ui-workspace-*` tokens. Keep hit targets at `--ui-hit-touch-min` for mobile and icon-only controls.
- **Dashboard:** Prefer rails, separators, charts, workload bars, matrix views, KPI strips, and tabular summaries. Use dashboard tokens for chart grids, tooltips, workload levels, and workflow bars.
- **Board:** The Kanban board is allowed to horizontally scan on desktop. Board columns should stay visually quiet; task cards and action islands carry state. Mobile uses tabs, pull-to-refresh, and a bottom action pattern.
- **Task cards:** Keep cards compact, opaque, and position-independent. Workflow status and execution state are separate: lifecycle status uses status buttons/indicators; queued/running execution state uses chips, shadows, and wave decoration.
- **Project roster:** Use dense cards with project state tones, metric strips, activity bars, and direct links. Background image cards must preserve foreground contrast using `--ui-on-accent`.
- **Task editor:** Use a two-column editor/metadata layout on wide screens, then stack on narrower containers. Reading/comment surfaces use `--ui-reading-*` tokens.
- **Settings/admin:** Use `--ui-admin-*` tokens. These surfaces should be plain, form-forward, and low-shadow.
- **Connections/API keys:** Use table and security tokens. Tables may become card rows on narrow screens, but data labels and destructive actions must stay explicit.
- **Modals and drawers:** Use `--ui-surface-modal*` tokens, `--ui-elevation-3`, and blur only where the shell already uses it. Full-screen mobile modals should remove rounded desktop chrome.

## Spacing And Density

- **Base unit:** 4px for app density.
- **Common steps:** 4, 8, 12, 16, 24, 32, 48, and 64px.
- **Desktop density:** Compact is acceptable on operational surfaces when scanning improves.
- **Touch density:** Mobile, drawer, modal, and icon-only controls must respect `--ui-hit-touch-min`.
- **Text fit:** Dense chips, task keys, project names, and menu labels should use `min-width: 0`, truncation, or wrapping rather than forcing overflow.

## Layout

- **Approach:** Grid-disciplined product UI. Use cards for functional units, not as default section wrappers.
- **Page surfaces:** Full-width layout shells with constrained inner content are preferred over nested cards.
- **Cards:** Use cards for tasks, projects, repeated rows, panels, and modals. Avoid decorative card stacks.
- **Radius:** Mantine `md` is the default. Current dense chrome commonly uses 6-8px; content cards often use 8-12px. Avoid new large rounded containers unless the existing surface pattern already uses them.
- **Responsive behavior:** Prefer wrapping, stacking, and explicit mobile variants. Do not introduce fixed-width overflow except where the Kanban board intentionally scans.

## Motion And Interaction

- **Approach:** Minimal-functional.
- **Durations:** 120-180ms for hover/focus state changes; 180-250ms for reveals, modal resize, and small layout changes.
- **Allowed motion:** Hover lift, menu reveal, modal resizing, focused-card pulse, board drag feedback, queued/running card wave animation, pull-to-refresh state.
- **Reduced motion:** Any repeating or decorative animation must honor `prefers-reduced-motion`.
- **Focus:** Use `outline: 2px solid var(--ui-focus-ring)` or an equivalent visible tokenized focus treatment. Do not rely on color alone.

## Content Rules

- Use English product copy in the open-source app.
- Use sentence case in page titles, buttons, menus, and labels.
- Use `PreqStation` for the product name, `preqstation` for the package/repo, and `PREQ` for the CLI.
- Keep copy short and operator-facing. Prefer direct labels such as `Refresh`, `Open task`, `Revoke`, and `Authorization failed`.
- Avoid emoji and apologetic UX filler. Existing legacy emoji affordances should not be expanded.

## Implementation Rules

- Reuse `--ui-*` tokens before adding new color or surface values.
- Add a new app-level token only when at least two surfaces need the same semantic value.
- Keep single-surface mechanics as component-local variables.
- Do not introduce a token pipeline or external design-token build step yet.
- Do not replace Mantine's theme system. Use it as the bridge to library components.
- Use Mantine primitives and Tabler icons for production UI unless a feature already has a supported product/vendor asset.
- Before changing UI code, check `DESIGN.md`, `docs/design-system.md`, `app/globals.css`, and `app/providers.tsx`.
- Verify dark mode first, then light mode.
- Check responsive behavior, keyboard focus, and reduced-motion behavior before shipping UI changes.

## Decisions Log

| Date       | Decision                                           | Rationale                                                                                                                 |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-13 | Created the lightweight design system contract     | The app already had useful `--ui-*` tokens and Mantine theme config, but no canonical design-system document.             |
| 2026-04-13 | Kept the existing blue brand and dark-mode default | This avoids broad visual churn while making the current system easier to maintain.                                        |
| 2026-04-13 | Deferred a token build pipeline                    | The repo has one app and no multi-platform token consumer, so a pipeline would add overhead before it removes complexity. |
| 2026-06-08 | Reframed `DESIGN.md` around current implementation | The app now has distinct workspace, dashboard, board, modal, admin, table, reading, and security token families.          |
