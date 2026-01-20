# Notion-Like Editor - Remaining TODO

Remaining features sorted by importance.

---

## High Priority

### 1. Full-Text Search

**Goal**: Search within and across documents.

**Steps**:

1. Use Convex search or external search (Algolia, Typesense)
2. Build search modal (Cmd/Ctrl+K)
3. Highlight search results in document
4. Search across all documents

---

### 2. Image Resize Controls

**Goal**: Allow users to resize images in the editor.

**Steps**:

1. Add resize handles to image nodes
2. Store width/height in node attributes
3. Persist dimensions to Convex

**Files to modify**:

- `src/extensions/image.ts`

---

## Medium Priority

### 3. Embed Blocks

**Goal**: Support YouTube, Twitter, and other embeds.

**Steps**:

1. Create embed node type with URL parsing
2. Support oEmbed for automatic previews
3. Add `/embed` slash command

---

### 4. User Presence Indicators

**Goal**: Show collaborator cursors and avatars in real-time.

**Steps**:

1. Add user presence indicators (cursors, avatars)
2. Show who's viewing/editing
3. Color-code by user

**Files to modify**:

- `src/extensions/block-sync.ts`

---

### 5. Comments & Highlights

**Goal**: Add commenting and text highlighting.

**Steps**:

1. Create `CommentMark` for text selection
2. Build comments sidebar panel
3. Implement comment threading

---

## Lower Priority

### 6. Nested Pages / Databases

**Goal**: Support pages within pages and simple databases.

**Steps**:

1. Create a `PageReference` node type
2. Build page tree navigation sidebar
3. Implement database-like table blocks:
   - Properties (text, number, select, date)
   - Inline editing
   - Filtering and sorting

---

### 7. Performance Optimization

**Goal**: Ensure smooth editing with large documents.

**Steps**:

1. Implement virtualization for long documents
2. Optimize Convex queries with pagination

---

### 8. Drag-and-Drop Link Creation

**Goal**: Create links by dragging URLs onto text.

**Files to modify**:

- `src/components/editor/link-popover.tsx`
