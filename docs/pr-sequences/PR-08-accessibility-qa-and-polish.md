# PR 08: Accessibility, Motion, QA, and Cleanup

## Goal

Finalize rollout quality with accessibility fixes, motion compliance, and cross-route visual consistency checks.

## In Scope

- Cross-route accessibility hardening.
- Motion and reduced-motion compliance.
- Final consistency pass for tokens and component usage.
- Remove temporary style drift from migration period.

## Out of Scope

- New design features.
- New product capabilities.

## Files To Add or Edit

- `src/styles.css`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/analytics/AnalyticsDashboard.tsx`
- `src/components/leeches/LeechesPage.tsx`
- `src/routes/index.tsx`
- `src/routes/doc.$docId.tsx`
- `src/routes/study.tsx`
- `src/routes/share.$slug.tsx`

## Implementation Steps

1. Audit focus visibility and enforce consistent focus ring contrast.
2. Verify text and UI contrast against WCAG AA across light and dark themes.
3. Add or adjust `prefers-reduced-motion` handling on transitions and animations.
4. Ensure chart labels and summaries are present and meaningful.
5. Remove route-specific one-off visual overrides that duplicate system tokens.
6. Update docs with final route coverage completion checklist.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`
4. `bun run check`

## QA Checklist

- Keyboard-only navigation works across all main routes.
- No unreadable color combinations in either theme.
- Motion is reduced correctly when OS setting requests it.
- Final UI remains consistent across all route groups.

## Done When

- Accessibility and motion requirements from `design.md` are met across the app.
- No unresolved route-level visual drift remains.

## Rollback

- Revert accessibility/style-only changes per file group if regressions appear.
