# PR 04: `/analytics` Migration

## Goal

Migrate analytics to the new editorial design system as the reference implementation for all other data pages.

## In Scope

- Refactor analytics layout and card hierarchy to new primitives.
- Enforce chart standards from `design.md`.
- Keep all current analytics data and interactions intact.

## Out of Scope

- New analytics metrics.
- Backend or query changes in Convex functions.

## Files To Add or Edit

- `src/routes/analytics.tsx`
- `src/components/analytics/AnalyticsDashboard.tsx`

## Implementation Steps

1. Replace local card/layout patterns with:
   - `AnalyticsSection`
   - `AnalyticsCard`
   - `MetricCard`
   - `ChartFrame`
2. Ensure retention chart includes 85% benchmark line.
3. Standardize chart treatment:
   - Core line width `2px`.
   - Grid line `1px` dashed low contrast.
4. Keep interactions unchanged:
   - Tooltips.
   - Legend behavior.
   - Existing navigation flows.
5. Confirm header styling aligns with shell standards.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- `/analytics` visually matches the new brief.
- No data mismatches versus before baseline.
- Desktop and mobile remain readable.
- Empty states remain functional and informative.

## Done When

- `/analytics` is fully tokenized and primitive-based.
- This route can serve as the implementation pattern for later PRs.

## Rollback

- Revert `src/components/analytics/AnalyticsDashboard.tsx` and related imports.
