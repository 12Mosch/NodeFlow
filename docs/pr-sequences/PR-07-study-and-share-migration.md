# PR 07: Study and Public Share Migration

## Goal

Complete the redesign across study flows and public share pages while preserving existing route behavior.

## In Scope

- Migrate study route and study mode surfaces.
- Migrate share route shell and public document framing.
- Keep auth/public access behavior intact.

## Out of Scope

- Study algorithm logic changes.
- Share permission model changes.

## Files To Add or Edit

- `src/routes/study.tsx`
- `src/routes/share.$slug.tsx`
- `src/components/study/SpacedRepetitionMode.tsx`
- `src/components/study/RandomMode.tsx`
- `src/components/document-learn-quiz.tsx`
- `src/components/flashcards/flashcard-quiz.tsx`
- `src/components/flashcards/quiz-results.tsx`
- `src/components/public-document-viewer.tsx`
- `src/components/presence/collaborator-avatars.tsx` (visual alignment only)

## Implementation Steps

1. Apply shared shell/typography/spacing to `study.tsx` and mode components.
2. Align quiz and results UI with card and metric system.
3. Apply public-safe shell styling to shared document page.
4. Keep read-only/edit split exactly as currently implemented.
5. Ensure collaborator avatar UI remains legible in both themes.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- Study mode selection and transitions are unchanged.
- Shared links still load for anonymous users.
- Edit/view permissions still gate editor access correctly.

## Done When

- Remaining major routes conform to the new design language.

## Rollback

- Revert listed study and share files.
