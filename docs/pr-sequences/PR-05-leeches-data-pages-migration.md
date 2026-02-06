# PR 05: `/study-leeches` and Leeches Components Migration

## Goal

Apply the same design system to leeches workflows to validate consistency on another dense analytics surface.

## In Scope

- Redesign leeches page shell, cards, stats, and table visuals.
- Keep all bulk actions and row interactions unchanged.

## Out of Scope

- Changes to leech detection logic.
- Query or mutation behavior changes.

## Files To Add or Edit

- `src/routes/study-leeches.tsx`
- `src/components/leeches/LeechesPage.tsx`
- `src/components/leeches/LeechStatsOverview.tsx`
- `src/components/leeches/LeechesTable.tsx`
- `src/components/leeches/LeechCardRow.tsx`
- `src/components/leeches/BulkActionsToolbar.tsx`

## Implementation Steps

1. Migrate page shell to shared header/content pattern.
2. Refactor stats tiles to `MetricCard` visual rules.
3. Refactor table and row treatments:
   - Border and spacing standards.
   - Readability-focused row density.
4. Keep all actions and callbacks unchanged:
   - Select row.
   - Bulk operations.
   - Navigation/back actions.
5. Confirm destructive action styling still meets contrast requirements.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- No regressions in filtering, selection, and bulk operations.
- Visual rhythm matches `/analytics`.
- Table remains keyboard navigable.

## Done When

- Leech surfaces look and behave consistently with the new system.

## Rollback

- Revert touched `src/components/leeches/*` files and `src/routes/study-leeches.tsx`.
