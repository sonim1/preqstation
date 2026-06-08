# Design System

PreqStation's product UI follows the contract in [DESIGN.md](../DESIGN.md).
This page turns that contract into code-facing tokens, components, and usage
rules.

## Product Posture

PreqStation is an owner-only command center for one developer operating
projects, tasks, work logs, dispatch state, QA runs, and connected clients. The
UI should feel like a calm operator desk: dark-first, compact, technical, and
low-noise.

This is authenticated product UI, not marketing. Prefer dense scanning,
reliable state, and explicit controls over decorative sections, oversized hero
copy, stock imagery, emoji state markers, or generic SaaS chrome.

## Source Of Truth

| Layer               | File                                                                 | Owns                                                                   |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Product contract    | [DESIGN.md](../DESIGN.md)                                            | Direction, surface rules, implementation rules, decision log           |
| Semantic CSS tokens | [app/globals.css](../app/globals.css)                                | `--ui-*`, `--kanban-*`, Mantine overrides, global focus, body surfaces |
| Mantine bridge      | [app/providers.tsx](../app/providers.tsx)                            | Brand scale, Pretendard stack, radius, color-scheme provider           |
| Scheme defaults     | [app/theme-config.ts](../app/theme-config.ts)                        | Dark default and localStorage key                                      |
| Component mechanics | CSS modules under [app/components](../app/components) and route dirs | Single-surface layout, sizing, and interaction details                 |

Do not add a token pipeline or external token build step yet. CSS variables in
`app/globals.css` are the canonical implementation.

## Theme Foundation

- Default color scheme: `dark`.
- Scheme storage key: `preqstation-color-scheme`.
- Primary color: Mantine `brand`.
- Primary shade: `6` in light mode, `5` in dark mode.
- Default radius: Mantine `md`.
- Auto contrast: enabled with `luminanceThreshold: 0.3`.
- Font family:
  `Pretendard, Inter, SF Pro Text, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`.
- Heading family:
  `Pretendard, Inter, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`.

### Brand Scale

Use Mantine `brand` for library components. Use `--ui-accent` tokens in CSS.

| Step | Hex       | Typical use                                     |
| ---- | --------- | ----------------------------------------------- |
| 0    | `#edf3ff` | Lightest tint, rare backgrounds                 |
| 1    | `#d9e5ff` | Soft selected state                             |
| 2    | `#b7cdff` | Accent tint                                     |
| 3    | `#8caeff` | Hover tint                                      |
| 4    | `#668fee` | Secondary accent                                |
| 5    | `#345fdd` | Dark-mode primary shade                         |
| 6    | `#274dc4` | Light-mode primary shade and `--ui-accent`      |
| 7    | `#1f3ea0` | Light-mode strong accent and active borders     |
| 8    | `#1c3587` | Pressed state                                   |
| 9    | `#192c6f` | Highest contrast brand ink on light backgrounds |

## Token Architecture

Token names describe semantics, not colors. Use these layers in order:

1. Mantine theme values for routine component props.
2. `--ui-*` semantic tokens for shared app surfaces, state, focus, and depth.
3. Surface family tokens such as `--ui-admin-*`, `--ui-table-*`, or
   `--ui-workspace-*` for repeated product areas.
4. Component-local custom properties for one component's mechanics only.

Promote a component-local variable to `--ui-*` only when multiple surfaces need
the same semantic value. Do not add tokens for one-off spacing or decorative
effects.

## Core Tokens

| Family       | Tokens                                                                                                                        | Use for                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Base surface | `--ui-surface`, `--ui-surface-soft`, `--ui-surface-strong`, `--ui-body-surface`, `--ui-body-background`                       | App background, shell panels, default component backgrounds |
| Text         | `--ui-text`, `--ui-muted-text`, `--ui-on-accent`, `--ui-on-danger`                                                            | Foreground, secondary metadata, text on filled actions      |
| Accent       | `--ui-accent`, `--ui-accent-strong`, `--ui-accent-soft`                                                                       | Primary actions, selected states, focus affordances         |
| State        | `--ui-success`, `--ui-danger`, `--ui-warning`, `--ui-neutral-strong` and soft variants                                        | Semantic success, destructive, warning, neutral states      |
| Focus        | `--ui-focus-ring`                                                                                                             | Keyboard focus ring and focus shadows                       |
| Hit targets  | `--ui-hit-min`, `--ui-hit-touch-min`, `--ui-control-sm`, `--ui-control-md`, `--ui-field-min-height`, `--ui-action-min-height` | Dense controls and mobile-safe controls                     |
| Depth        | `--ui-elevation-0`, `--ui-elevation-1`, `--ui-elevation-2`, `--ui-elevation-3`, `--ui-shadow`                                 | Cards, popovers, modals, hover lift                         |
| Syntax       | `--ui-syntax-selector`, `--ui-syntax-function`                                                                                | Markdown/code rendering accents                             |
| Global state | `--ui-state-shell-surface`, `--ui-state-shell-border`, `--ui-state-shell-muted-surface`                                       | Empty states, route state pages, compact status panels      |

## Surface Token Families

| Family       | Tokens                                                                                                                                                                                                  | Use for                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Reading      | `--ui-reading-surface`, `--ui-reading-surface-soft`, `--ui-reading-border`, `--ui-reading-code-border`                                                                                                  | Markdown viewer/editor, prompts, comments, code snippets  |
| Panels/cards | `--ui-card-bg`, `--ui-hero-bg`, `--ui-surface-card`, `--ui-surface-panel`, `--ui-surface-panel-strong`, `--ui-surface-muted`, `--ui-panel-orb`                                                          | Project cards, page panels, lifted product surfaces       |
| Elevated     | `--ui-surface-elevated`, `--ui-surface-elevated-strong`, `--ui-surface-lifted`                                                                                                                          | Menus, active cards, higher-contrast nested panels        |
| Modals       | `--ui-surface-modal`, `--ui-surface-modal-header`, `--ui-surface-modal-body`                                                                                                                            | Task panel modal, QA modal, drawers                       |
| Tables       | `--ui-table-surface`, `--ui-table-border`, `--ui-table-header-surface`, `--ui-table-row-border`, `--ui-table-row-hover`, `--ui-table-row-selected`, `--ui-table-card-surface`, `--ui-table-card-border` | API keys, connections, narrow card-row conversions        |
| Workspace    | `--ui-workspace-control-*`, `--ui-workspace-popover-*`, `--ui-workspace-accent-*`, `--ui-workspace-focus-shadow`                                                                                        | Header controls, project picker, account menu, mobile nav |
| Admin        | `--ui-admin-surface*`, `--ui-admin-border*`, `--ui-admin-control-*`, `--ui-admin-status-*`, `--ui-admin-danger-*`                                                                                       | Settings, labels, forms, Telegram settings                |
| Security     | `--ui-security-control-*`, `--ui-security-success-*`, `--ui-security-warning-*`, `--ui-security-danger-*`, `--ui-security-neutral-*`                                                                    | API keys, connections, auth/security alerts               |
| Dashboard    | `--ui-dashboard-seam`, `--ui-dashboard-seam-fade`, `--ui-dashboard-chart-*`, `--ui-workload-level-*`, `--ui-on-workload-level-*`                                                                        | Operator dashboard charts, workload cells, KPI rails      |
| Board        | `--kanban-frame-*`, `--kanban-stage-surface`, `--kanban-card-surface`, `--kanban-card-shadow-*`                                                                                                         | Board frame, columns, mobile tabs, task card depth        |

## Workflow And Execution Tokens

Workflow status and execution state are separate concepts.

| Concept            | Tokens                                                                                                                                                                             | Use for                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Lifecycle status   | `--ui-workflow-status-inbox`, `--ui-workflow-status-todo`, `--ui-workflow-status-hold`, `--ui-workflow-status-ready`, `--ui-workflow-status-done`, `--ui-workflow-status-archived` | Task status dots, lane markers, badges    |
| Dashboard workflow | `--ui-workflow-inbox`, `--ui-workflow-todo`, `--ui-workflow-hold`, `--ui-workflow-ready`, `--ui-workflow-done`, `--ui-on-workflow-ready`                                           | Dashboard bars and aggregate charts       |
| Queued execution   | `--ui-status-queued`, `--ui-status-queued-foreground`, `--ui-status-queued-border`                                                                                                 | Agent run queued chips and card emphasis  |
| Running execution  | `--ui-status-running`, `--ui-status-running-foreground`, `--ui-status-running-soft`, `--ui-status-running-border`, `--ui-status-running-border-strong`, `--ui-status-running-glow` | Running chips, card wave, active run glow |
| Status history     | `--ui-status-history-badge-border-mix`, `--ui-status-history-warning-border`, `--ui-status-history-success-border`                                                                 | Status history breadcrumbs and badges     |

Do not encode execution state by changing workflow status color. A `ready`
task can still have queued/running dispatch state.

## Typography

- Use the configured Pretendard-first stack from Mantine.
- Do not introduce a second display face inside the authenticated app.
- Use Mantine's type scale for routine UI.
- Use explicit font sizes only for dense operational surfaces that need stable
  layout.
- Use monospace for task keys, commands, logs, snippets, token names,
  timestamps, and compact chart labels.
- Keep letter spacing at `0` for body copy. The wordmark may use slight
  positive tracking.

## Spacing, Radius, And Density

| Primitive            | Rule                                                               |
| -------------------- | ------------------------------------------------------------------ |
| Base spacing         | 4px grid                                                           |
| Common steps         | 4, 8, 12, 16, 24, 32, 48, 64px                                     |
| Dense control height | `--ui-control-sm` or `--ui-control-md`                             |
| Mobile hit target    | `--ui-hit-touch-min`                                               |
| Default radius       | Mantine `md`                                                       |
| Dense chrome radius  | 4-8px                                                              |
| Content card radius  | 8-12px                                                             |
| Modal chrome         | Desktop may be rounded; full-screen mobile modals should be square |

Operational density is allowed when it improves scanning. Prevent overflow with
`min-width: 0`, truncation, and wrapping instead of fixed widths.

## Component Patterns

### Workspace Shell

Use `--ui-workspace-*` for header controls, sidebar/project picker controls,
account menus, command palette triggers, popovers, and mobile project switchers.
Icon-only controls must meet `--ui-hit-touch-min` on touch surfaces.

### Dashboard

Dashboards should use rails, seams, charts, workload bars, matrix views, KPI
strips, and tabular summaries. Use `--ui-dashboard-*`,
`--ui-workload-level-*`, and workflow tokens. Avoid marketing cards and oversized
hero treatments.

### Board

The desktop Kanban board may scan horizontally. Columns should stay visually
quiet; cards and action islands carry state. Use `--kanban-frame-*` for board
chrome and `--kanban-card-*` for card surfaces and shadows. Mobile uses tabs,
pull-to-refresh, and bottom actions.

### Task Cards

Task cards stay compact and opaque. Workflow status appears as lifecycle
indicators. Execution state appears as chips, card depth, and the queued/running
wave treatment. Do not merge these states into one color rule.

### Task Editor And Reading Surfaces

Use a two-column editor/metadata layout on wide screens, then stack on narrower
containers. Markdown, comments, generated prompts, and code previews use
`--ui-reading-*`. Preserve copy/select behavior for prompt and code surfaces.

### Modals And Drawers

Use `--ui-surface-modal*` and `--ui-elevation-3`. Desktop modals may use blur and
rounded chrome. Full-screen mobile modals should remove desktop rounding and
respect safe-area spacing.

### Settings And Admin

Use `--ui-admin-*`. Settings pages should be plain, form-forward, and low-shadow.
Label tiles, color pickers, Telegram settings, and form panel sections should
not invent local palettes.

### Tables, API Keys, And Connections

Use table tokens for dense rows and security tokens for auth, connection, and
destructive surfaces. On narrow screens, tables may become cards using
`--ui-table-card-*`, but data labels and destructive actions must remain
explicit.

### Project Roster

Use dense project cards with state tones, metric strips, activity bars, and
direct links. Background image cards must preserve contrast using
`--ui-on-accent` overlays and tokenized borders.

## Mantine Bridge Rules

- Prefer Mantine primitives for production UI.
- Prefer Tabler icons for generic product actions.
- Use supported vendor/product assets from `public/icons/` only when the surface
  represents a real engine or integration.
- Let Mantine handle routine sizing, disabled states, and form semantics.
- Use CSS tokens for product-specific semantic color, custom shell chrome, and
  route-level surfaces.

## Usage Examples

### Tokenized Card

```css
.project-card {
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  background: var(--ui-card-bg);
  color: var(--ui-text);
  box-shadow: var(--ui-elevation-1);
}
```

### Admin Control

```css
.settings-control {
  min-height: var(--ui-hit-touch-min);
  border: 1px solid var(--ui-admin-control-border);
  border-radius: var(--mantine-radius-md);
  background: var(--ui-admin-control-surface);
  color: var(--ui-text);
}
```

### Execution State

```css
.task-run-chip[data-state='running'] {
  border-color: var(--ui-status-running-border);
  background: var(--ui-status-running-soft);
  color: var(--ui-status-running-foreground);
  box-shadow: 0 0 18px var(--ui-status-running-glow);
}
```

### Focus

```css
.control:focus-visible {
  outline: 2px solid var(--ui-focus-ring);
  outline-offset: 2px;
}
```

## Adding Or Changing Tokens

Use this decision path:

1. If the value is only for one component's size, radius, or layout math, keep it
   component-local.
2. If the value is a shared color, surface, state, focus, or elevation semantic,
   use an existing `--ui-*` token first.
3. If at least two surfaces need a missing semantic, add a new `--ui-*` token to
   both light and dark schemes in `app/globals.css`.
4. If the token is tied to a repeated product area, name it by family:
   `--ui-admin-*`, `--ui-table-*`, `--ui-workspace-*`, `--ui-security-*`, or
   `--kanban-*`.
5. Update [DESIGN.md](../DESIGN.md) and this guide when the token changes the
   contract, not for one-off component mechanics.

## Accessibility And Interaction

- Focus states must be visible and tokenized.
- State must not rely on color alone; pair color with text, icon, position, or
  shape.
- Repeating or decorative motion must honor `prefers-reduced-motion`.
- Use 120-180ms for hover/focus changes and 180-250ms for small reveals.
- Do not use emoji as production state UI.
- Mobile, drawer, modal, and icon-only controls must meet `--ui-hit-touch-min`.

## Content Rules

- Use English product copy in the open-source app.
- Use sentence case for page titles, buttons, menus, and labels.
- Use `PreqStation` for the product name, `preqstation` for the package/repo,
  and `PREQ` for the CLI.
- Keep copy short and operator-facing: `Refresh`, `Open task`, `Revoke`,
  `Authorization failed`.
- Avoid apologetic UX filler and generic placeholder labels.

## Pre-Change Checklist

Before changing UI code:

1. Read [DESIGN.md](../DESIGN.md), this guide,
   [app/globals.css](../app/globals.css), and
   [app/providers.tsx](../app/providers.tsx).
2. Identify the surface family: workspace, dashboard, board, admin, table,
   security, modal, reading, or general product chrome.
3. Reuse existing `--ui-*` or `--kanban-*` tokens before adding values.
4. Keep single-surface mechanics local.
5. Verify dark mode first, then light mode.
6. Check responsive behavior, keyboard focus, and reduced-motion behavior.
7. Run relevant token and surface tests before shipping.

## Current Alignment Notes

Most high-value follow-up work is normalization, not a rebrand:

- Board task cards should rely less on bespoke shadows, emoji/glyph state, and
  colored side strips.
- Dispatch and QA controls should avoid emoji-based labels and use shared
  icon/token patterns.
- Workspace chrome should consistently use the product wordmark and sentence
  case specified by the content rules.
- Tooltips, label surfaces, and dense card metadata should prefer `--ui-*`
  tokens over hard-coded fallback colors.
