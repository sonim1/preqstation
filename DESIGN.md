# Design System - Preq Station

## Product Context

- **What this is:** Preq Station is an owner-only project management command center for a single developer.
- **Who it is for:** The primary user is the owner/operator managing personal projects, tasks, work logs, and AI agent execution state.
- **Space:** Personal project management, developer workflow, AI agent operations, and lightweight portfolio control.
- **Project type:** Authenticated web app and dashboard. The dashboard, Kanban board, projects roster, settings, and connections pages are the core surfaces.

## Aesthetic Direction

- **Direction:** Calm operator desk.
- **Decoration level:** Intentional, not ornamental. Use subtle depth, quiet gradients, and small state signals only where they clarify status.
- **Mood:** Focused, technical, and low-noise. The product should feel like a control room for one capable operator, not a generic SaaS dashboard.
- **Current baseline:** Keep the existing blue brand identity, dark-mode default, compact dashboard density, and Mantine component base.

## Typography

- **Application font:** Pretendard with `Inter`, `SF Pro Text`, and system sans-serif fallbacks, as configured in `app/providers.tsx`.
- **Headings:** Pretendard with `Inter`, `SF Pro Display`, and system sans-serif fallbacks.
- **Data and code:** Use Mantine's monospace token for code-like task keys, logs, and technical snippets.
- **Scale:** Prefer Mantine's type scale for routine UI. Use explicit sizes only for high-density app surfaces where layout stability is required.
- **Rule:** Do not introduce a second display font until the product has a dedicated marketing surface or a specific screen-level design calls for it.

## Color

- **Approach:** Balanced. One blue brand scale carries primary action and focus, while semantic colors carry state.
- **Primary brand:** `#274dc4` in light mode and `#3e6ae1` in dark mode via `--ui-accent`.
- **Primary strong:** `#1f3ea0` in light mode and `#365fcd` in dark mode via `--ui-accent-strong`.
- **Surfaces:** Use `--ui-surface`, `--ui-surface-soft`, `--ui-surface-strong`, `--ui-surface-panel`, `--ui-surface-muted`, and `--ui-surface-elevated` instead of one-off surface colors.
- **Text:** Use `--ui-text` and `--ui-muted-text` for app chrome and CSS-module UI. Mantine text props may still use Mantine's semantic text colors when they resolve cleanly to the active scheme.
- **State:** Use `--ui-success`, `--ui-danger`, `--ui-warning`, `--ui-neutral-strong`, and their soft variants for status, alerts, and badges.
- **Execution state:** Use `--ui-status-queued`, `--ui-status-running`, and related border/glow tokens for live agent execution state.
- **Dark mode:** Dark mode is the default. Redesign surfaces for dark mode rather than simply inverting light colors.

## Token Contract

Canonical tokens live in `app/globals.css`. Treat `--ui-*` variables as the app-level semantic layer:

- `--ui-surface`, `--ui-surface-soft`, `--ui-surface-strong`: base surface hierarchy.
- `--ui-surface-panel`, `--ui-surface-panel-strong`, `--ui-surface-muted`, `--ui-surface-muted-strong`: shared panel and quiet-surface variants.
- `--ui-surface-elevated`, `--ui-surface-elevated-strong`: card and raised chrome surfaces.
- `--ui-border`, `--ui-shadow`, `--ui-elevation-0`, `--ui-elevation-1`, `--ui-elevation-2`, `--ui-elevation-3`: borders and depth.
- `--ui-text`, `--ui-muted-text`: foreground text.
- `--ui-accent`, `--ui-accent-strong`, `--ui-accent-soft`: primary action and focus.
- `--ui-success`, `--ui-danger`, `--ui-warning`, `--ui-neutral-strong` and soft variants: semantic state.
- `--ui-focus-ring`: focus outlines.
- `--ui-hit-min`, `--ui-hit-touch-min`, `--ui-control-sm`, `--ui-control-md`: interactive sizing.
- `--ui-status-queued`, `--ui-status-running`, and related border/glow tokens: agent run state.

Component-local variables are allowed when they describe one surface's mechanics, such as `--kanban-card-radius`, `--heatmap-cell-size`, or `--button-height`. They should derive from app tokens when they represent color, surface, focus, or elevation.

Mantine theme values in `app/providers.tsx` are the component-library bridge. Keep brand color, radius, font, and contrast behavior there, but keep product-specific surface decisions in `app/globals.css`.

## Spacing

- **Base unit:** 4px for fine-grained app density, with Mantine spacing tokens for common layout gaps.
- **Density:** Compact but touch-aware. Dense desktop surfaces are fine, but mobile and icon-only controls must respect `--ui-hit-touch-min`.
- **Scale:** Use 4, 8, 12, 16, 24, 32, 48, and 64px steps for new layout work unless a component already has established local sizing.

## Layout

- **Approach:** Hybrid. Use grid-disciplined layouts for dashboard, board, settings, and connections. Use more editorial composition only in overview or project-portfolio surfaces where it improves scanning.
- **Cards:** Cards are functional units, not default section wrappers. Prefer full-width bands or plain layout containers for page sections.
- **Radius:** Default to Mantine `md` for general controls. Use smaller radius for dense operational chrome and avoid adding new large rounded containers by default.
- **Responsive rule:** Prefer wrapping, stacking, or constrained grids over fixed-width overflow, except for the Kanban board where horizontal scanning is part of the workflow.

## Motion

- **Approach:** Minimal-functional.
- **Durations:** Prefer 120-180ms for hover/focus state changes and 180-250ms for small layout reveals.
- **Rule:** Animation must clarify state or interaction. Avoid decorative motion on busy operational surfaces.
- **Performance:** Repeated run-state indicators should stay cheap and respect reduced-motion expectations when expanded.

## Implementation Rules

- Reuse `--ui-*` tokens before adding new color or surface values.
- Add a new app-level token only when at least two surfaces need the same semantic value.
- Keep single-surface mechanics as component-local variables.
- Do not introduce a token pipeline or external design-token build step yet.
- Do not replace Mantine's theme system. Use it as the bridge to library components.
- When touching UI code, check `DESIGN.md`, `app/globals.css`, and `app/providers.tsx` before adding visual decisions.

## Decisions Log

| Date       | Decision                                           | Rationale                                                                                                                 |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-13 | Created the lightweight design system contract     | The app already had useful `--ui-*` tokens and Mantine theme config, but no canonical design-system document.             |
| 2026-04-13 | Kept the existing blue brand and dark-mode default | This avoids broad visual churn while making the current system easier to maintain.                                        |
| 2026-04-13 | Deferred a token build pipeline                    | The repo has one app and no multi-platform token consumer, so a pipeline would add overhead before it removes complexity. |
