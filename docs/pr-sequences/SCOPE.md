# Redesign Scope Contract

## Project

NodeFlow full-app visual redesign inspired by the editorial analytics style from `/4`.

## Date

February 6, 2026

## Core Problem

The current UI is visually inconsistent across routes, which reduces scan speed and weakens product identity.

## Success Criteria

- All main routes use one shared design system (tokens, spacing, typography, cards, chart rules).
- The app is recognizably aligned with the `/4` editorial style while preserving current behavior.
- No new product features are introduced as part of this redesign.

## In Scope (v1)

- Implement design tokens and typography foundation.
- Implement shared shell and analytics primitives.
- Migrate visual styling on these routes:
  - `/`
  - `/doc/$docId`
  - `/analytics`
  - `/study`
  - `/study-leeches`
  - `/share/$slug`
- Apply accessibility and reduced-motion compliance updates.
- Run route-level QA at defined breakpoints and themes.

## Explicitly Out of Scope

- New product features or workflow expansions.
- Convex schema/function changes not required by styling.
- Study algorithm changes (FSRS logic, scheduling behavior).
- Share permission model changes.
- Editor extension behavior changes unrelated to presentation.

## Non-Negotiables

- Route behavior must remain unchanged from baseline.
- Every PR must pass:
  - `bun run typecheck`
  - `bun run lint`
- Final PR must pass:
  - `bun run check`
  - `bun run test`
- Scope increases require explicit entry in `docs/pr-sequences/DECISION_LOG.md` and approval.

## Scope Change Policy

For any requested addition:

1. Log the request in `docs/pr-sequences/DECISION_LOG.md`.
2. State impact on timeline and risk.
3. Identify what is removed to keep scope balanced.
4. Do not implement until approved.

## Definition of Done

- PR 01 through PR 08 are completed per `docs/pr-sequences/PR-*.md`.
- Baseline comparison confirms no functional regressions.
- Accessibility, motion, and visual consistency checks are complete.
