# Design System

PreqStation's product UI follows the contract in [DESIGN.md](../DESIGN.md).
This page is the contributor-facing guide for applying that contract in code.

## Direction

PreqStation is an owner-only command center for a developer operating projects,
tasks, work logs, and AI-agent execution state. The interface should feel like a
calm operator desk: focused, technical, compact, and low-noise.

The app is not a marketing surface. Avoid decorative layout, oversized hero
patterns, stock imagery, emoji, and generic SaaS chrome. Use quiet depth,
disciplined grids, and small state signals that help the operator scan faster.

## Source Of Truth

- [DESIGN.md](../DESIGN.md) defines the product context, tone, token contract,
  spacing, layout, and implementation rules.
- [app/globals.css](../app/globals.css) owns the app-level semantic `--ui-*`
  CSS variables.
- [app/providers.tsx](../app/providers.tsx) bridges Mantine to the product
  brand scale, font stack, radius, and color-scheme defaults.
- `public/brand/` and `public/icons/` contain the product mark and supported
  agent/vendor icons.

Do not add a token pipeline or external token build step unless at least two
consumers need it. This repo is currently the canonical implementation.

## Tokens

Use semantic tokens before adding new colors:

- Surfaces: `--ui-surface`, `--ui-surface-soft`, `--ui-surface-strong`,
  `--ui-surface-panel`, `--ui-surface-panel-strong`,
  `--ui-surface-muted`, `--ui-surface-muted-strong`,
  `--ui-surface-elevated`, `--ui-surface-elevated-strong`,
  `--ui-card-bg`, `--ui-hero-bg`, `--ui-reading-surface`, and
  `--ui-reading-surface-soft`.
- Text: `--ui-text`, `--ui-muted-text`.
- Accent: `--ui-accent`, `--ui-accent-strong`, `--ui-accent-soft`.
- State: `--ui-success`, `--ui-danger`, `--ui-warning`,
  `--ui-neutral-strong`, and soft variants.
- Workflow state: `--ui-workflow-status-inbox`, `--ui-workflow-status-todo`,
  `--ui-workflow-status-hold`, `--ui-workflow-status-ready`,
  `--ui-workflow-status-done`, and `--ui-workflow-status-archived`.
- Execution state: `--ui-status-queued`, `--ui-status-running`, and related
  border/glow tokens.
- Interaction: `--ui-focus-ring`, `--ui-hit-min`, `--ui-hit-touch-min`,
  `--ui-control-sm`, `--ui-control-md`.
- Depth: `--ui-border`, `--ui-shadow`, `--ui-elevation-0..3`.

Component-local variables are fine for a single surface's mechanics, such as
card radius, cell size, or a layout-specific measurement. If a variable describes
shared color, surface, focus, or elevation semantics, promote it to the app
token layer only when multiple surfaces need it.

## Typography

Use the configured Pretendard-first stack from Mantine. Do not introduce a
second display font inside the authenticated app.

Routine UI should use Mantine's type scale. Explicit sizes are acceptable for
dense operational surfaces where layout stability matters. Task keys, commands,
logs, and snippets should use Mantine's monospace stack.

## Component Rules

- Use Mantine primitives and Tabler icons in production UI.
- Keep cards as functional units: task cards, repeated items, panels, and
  modals. Do not wrap every page section in a card.
- Default to `8px` radius for controls, `12px` for content cards, and `4-6px`
  for dense operational chrome.
- Use color plus icon or text for state. Do not use emoji as status UI.
- Show task execution state as an overlay separate from workflow status.
- Keep motion minimal and functional: 120-180ms for hover/focus, 180-250ms for
  small reveals, and honor `prefers-reduced-motion`.
- Focus states must use `outline: 2px solid var(--ui-focus-ring)` or an
  equivalent visible focus treatment. Do not rely on color alone.
- Mobile and icon-only controls must respect `--ui-hit-touch-min`.

## Content Rules

- Use English product copy in the open-source app.
- Use sentence case in page titles, buttons, menus, and labels.
- Use `PreqStation` for the product name, `preqstation` for the package/repo,
  and `PREQ` for the CLI.
- Keep copy short and operator-facing. Prefer direct labels such as `Refresh`,
  `Open task`, `Revoke`, and `Authorization failed`.
- Avoid emoji and apologetic UX filler.

## Pre-Change Checklist

Before changing UI code:

1. Read [DESIGN.md](../DESIGN.md), [app/globals.css](../app/globals.css), and
   [app/providers.tsx](../app/providers.tsx).
2. Identify whether the target surface already has a matching component or
   token pattern.
3. Replace one-off color, surface, focus, shadow, and radius decisions with
   design-system tokens.
4. Keep changes surgical. Do not refactor adjacent UI unless it is required for
   the design-system alignment.
5. Verify dark mode first, then light mode.
6. Check responsive behavior and keyboard focus before shipping.

## Current Alignment Notes

The design-system extraction matches the root `DESIGN.md` and current token
contract. Most high-value follow-up work is normalization, not a rebrand:

- Board task cards should rely less on bespoke shadows, emoji/glyph state, and
  colored side strips.
- Dispatch and QA controls should avoid emoji-based Telegram labels and use
  shared icon/token patterns.
- Workspace chrome should consistently use the product wordmark and sentence
  case specified by the content rules.
- Tooltips, label surfaces, and dense card metadata should prefer `--ui-*`
  tokens over hard-coded fallback colors.
