# PR 03: Shared Shell and Design Primitives

## Goal

Create reusable layout and analytics primitives so route migrations use a common system instead of one-off styles.

## In Scope

- Add shared page shell components.
- Add analytics card and metric primitives.
- Add chart frame wrapper for visual consistency.

## Out of Scope

- Full migration of all routes.
- Behavior changes to data fetching or navigation.

## Files To Add or Edit

- `src/components/ui/separator.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/button.tsx`
- `src/components/analytics/AnalyticsSection.tsx` (new)
- `src/components/analytics/AnalyticsCard.tsx` (new)
- `src/components/analytics/MetricCard.tsx` (new)
- `src/components/analytics/ChartFrame.tsx` (new)
- `src/components/analytics/index.ts` (new)

## Implementation Steps

1. Add `AnalyticsSection` for title, description, content rhythm.
2. Add `AnalyticsCard` for consistent border, padding, and optional muted background.
3. Add `MetricCard` variants:
   - `hero`
   - `default`
   - `compact`
4. Add `ChartFrame` wrapper with:
   - Standard caption zone.
   - Standard empty-state slot.
   - Standard legend slot.
5. Extend existing `Card`, `Button`, and `Separator` only where needed for design-system compatibility.
6. Export new primitives via `src/components/analytics/index.ts`.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- New primitives compile and are imported cleanly.
- No regressions in current routes using `Card`/`Button`.
- Primitives support both light and dark themes.

## Done When

- Route teams can migrate pages without creating new ad hoc wrappers.

## Rollback

- Revert new primitive files and small UI component adjustments.
