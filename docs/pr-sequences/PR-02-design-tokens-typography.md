# PR 02: Global Tokens and Typography Foundation

## Goal

Implement reusable design tokens and typography utilities that power the new editorial style app-wide.

## In Scope

- Add `--nf-*` design tokens for light and dark themes.
- Map tokens into existing shadcn token variables.
- Add typography utilities for serif display, sans UI, and meta labels.

## Out of Scope

- Route-level layout redesign.
- Component refactors outside token wiring.

## Files To Add or Edit

- `src/styles.css`

## Implementation Steps

1. Add `--nf-*` token definitions under `:root` and `.dark`.
2. Bind existing variables to new token values:
   - `--background`, `--foreground`, `--border`, `--card`, `--muted`, `--ring`.
3. Add typography utilities:
   - Serif display utility.
   - Sans utility.
   - Meta-label utility with uppercase and letter spacing.
4. Add spacing helper utilities aligned to 8px rhythm.
5. Ensure defaults still render for old components.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- No route breaks due to CSS variable regressions.
- Light and dark themes both reflect new neutral + accent system.
- Typography utilities can be used by all route surfaces.

## Done When

- Tokens are source-of-truth in `src/styles.css`.
- Existing UI still functions without route-specific refactors.

## Rollback

- Revert `src/styles.css`.
