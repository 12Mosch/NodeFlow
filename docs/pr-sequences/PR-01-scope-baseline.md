# PR 01: Scope Lock and Baseline Capture

## Goal

Freeze redesign scope and capture before-state references so later PRs stay focused and measurable.

## In Scope

- Add a scope contract for the redesign.
- Add baseline screenshot checklist and capture instructions.
- Add a redesign decision log template.

## Out of Scope

- Any UI or code styling changes.
- Any feature behavior changes.

## Files To Add or Edit

- `docs/pr-sequences/SCOPE.md` (new)
- `docs/pr-sequences/BASELINE.md` (new)
- `docs/pr-sequences/DECISION_LOG.md` (new)

## Implementation Steps

1. Create `docs/pr-sequences/SCOPE.md` with:
   - Core problem statement.
   - Success criteria.
   - Explicit in-scope areas.
   - Explicit out-of-scope areas.
2. Create `docs/pr-sequences/BASELINE.md` with required capture matrix:
   - Routes: `/`, `/doc/$docId`, `/analytics`, `/study`, `/study-leeches`, `/share/$slug`.
   - Breakpoints: `1440`, `1024`, `768`, `390`.
   - Themes: light and dark.
3. Create `docs/pr-sequences/DECISION_LOG.md` with a row format:
   - Date, request, source, decision, rationale, tradeoff.
4. Add one initial row in `DECISION_LOG.md`:
   - "No new product features during redesign."

## Validation

1. `bun run typecheck`
2. `bun run lint`

## QA Checklist

- SCOPE doc clearly lists what will not be built.
- Baseline doc includes all required routes and breakpoints.
- Decision log has at least one committed decision entry.

## Done When

- All three docs exist and are reviewed.
- Team agrees to scope lock before PR 02 starts.

## Rollback

- Revert documentation files only.
