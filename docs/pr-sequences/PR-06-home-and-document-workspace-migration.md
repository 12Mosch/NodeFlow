# PR 06: Home and Document Workspace Migration

## Goal

Apply the new design system to primary daily workflows: document list and document editing workspace.

## In Scope

- Home page visual migration.
- Document route shell and header migration.
- Sidebar/document list visual alignment.

## Out of Scope

- Editor extension behavior changes.
- Collaboration or data sync logic changes.

## Files To Add or Edit

- `src/routes/index.tsx`
- `src/routes/doc.$docId.tsx`
- `src/components/sidebar/document-sidebar.tsx`
- `src/components/sidebar/document-sidebar-content.tsx`
- `src/components/sidebar/document-list-item.tsx`
- `src/components/tiptap-editor.tsx` (layout/style only)
- `src/components/search-dialog.tsx` (visual alignment only)
- `src/components/study-mode-dialog.tsx` (visual alignment only)
- `src/components/share-dialog.tsx` (visual alignment only)

## Implementation Steps

1. Update home route shell, heading typography, and document list card treatment.
2. Apply shared header system in `doc.$docId`:
   - Sticky treatment.
   - Spacing and divider rhythm.
   - Consistent utility button styling.
3. Align sidebar and document-list components with tokenized spacing and border rules.
4. Update modal/dialog surfaces used in this route to design-system styles only.
5. Ensure editor chrome styling changes do not affect editing logic.

## Validation

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test`

## QA Checklist

- Create, delete, search, and open document flows still work.
- Editor collaboration presence and cursor indicators still render.
- Header actions still function on mobile and desktop.

## Done When

- Core daily authoring workflows use the new visual system with zero behavior regression.

## Rollback

- Revert route and component styling changes in the listed files.
