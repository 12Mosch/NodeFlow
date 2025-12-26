# Notion-Like Editor Implementation Roadmap

This document outlines the steps to implement a full Notion-like editor based on the existing Tiptap + Convex architecture.

## Current State

The foundation is already in place:

- ✅ Tiptap/ProseMirror editor with React
- ✅ Block-level tracking with UUIDs
- ✅ Convex backend for document and block storage
- ✅ Outliner keyboard shortcuts (Enter, Tab, Shift+Tab)
- ✅ Task lists with nested support

---

## Phase 1: Core Editor Features

### 1.1 Slash Commands Menu

**Goal**: Trigger a floating menu when typing `/` to insert different block types.

**Steps**:

1. Install `@tiptap/suggestion` package
2. Create a `SlashCommands` extension
3. Build a React component for the suggestion dropdown
4. Define available commands:
   - [ ] Text / Paragraph
   - [ ] Heading 1 / 2 / 3
   - [ ] Bullet List / Numbered List
   - [ ] To-do List
   - [ ] Code Block
   - [ ] Quote / Callout
   - [ ] Divider
   - [ ] Image (upload or embed URL)
5. Style the dropdown to match Notion's minimal design

**Files to create/modify**:

- `src/extensions/slash-commands.ts`
- `src/components/editor/slash-menu.tsx`

---

### 1.2 Block Drag & Drop

**Goal**: Add drag handles to each block for reordering.

**Steps**:

1. Create a `BlockWrapper` NodeView component
2. Add a drag handle icon (⋮⋮) that appears on hover
3. Implement ProseMirror drag-and-drop logic:
   - Capture drag start position
   - Calculate drop target position
   - Move the block in the document
4. Sync new block positions to Convex
5. Add visual feedback during drag (ghost indicator)

**Files to create/modify**:

- `src/components/editor/block-wrapper.tsx`
- Update existing extensions to use NodeViews

---

### 1.3 Block Type Conversions

**Goal**: Allow converting blocks between types.

**Steps**:

1. Create a block properties popup/menu
2. Add "Change Type" option when clicking block handle
3. Implement conversion logic:
   - Heading ↔ Paragraph
   - List types (bullet ↔ numbered ↔ toggle)
   - Text ↔ Quote
   - Text ↔ Code Block
4. Preserve content during conversion

---

## Phase 2: Rich Content Support

### 2.1 Inline Formatting Toolbar

**Goal**: Floating toolbar for text selection formatting.

**Steps**:

1. Install `@tiptap/extension-bubble-menu`
2. Create a bubble menu component with:
   - Bold / Italic / Strikethrough
   - Highlight color picker
   - Inline code
   - Link insert/edit
3. Configure to appear on text selection

---

### 2.2 Link Support

**Goal**: Support inline links with popup for editing.

**Steps**:

1. Use or extend `@tiptap/extension-link`
2. Create link input modal/popup
3. Add "Copy link" and "Remove link" options
4. Support drag-and-drop to create links

---

### 2.3 Image/Embed Blocks

**Goal**: Support images, videos, and embed blocks.

**Steps**:

1. Create `ImageBlock` NodeView component
2. Implement image upload to storage (Convex file storage or external)
3. Add image resize controls
4. Support for:
   - Upload from device
   - Paste URL
   - Drag & drop
5. Add support forembeds (YouTube, Twitter, etc.)

---

## Phase 3: Advanced Features

### 3.1 Nested Pages/Databases

**Goal**: Support pages within pages and simple databases.

**Steps**:

1. Create a `PageReference` node type
2. Build page tree navigation sidebar
3. Implement database-like table blocks:
   - Properties (text, number, select, date)
   - Inline editing
   - Filtering and sorting (optional, Phase 4)

---

### 3.2 Collaborative Editing

**Goal**: Real-time collaboration with presence.

**Steps**:

1. Leverage existing `@convex-dev/prosemirror-sync`
2. Add user presence indicators (cursors, avatars)
3. Show who's viewing/editing
4. Implement conflict resolution if needed

---

### 3.3 Comments & Highlights

**Goal**: Add commenting and text highlighting.

**Steps**:

1. Create `CommentMark` for text selection
2. Build comments sidebar panel
3. Implement comment threading
4. Add highlight color options

---

## Phase 4: Polish & Performance

### 4.1 Search

**Goal**: Full-text search within documents.

**Steps**1. Use Convex search or external search (Algolia, Typesense) 2. Build search modal (Cmd/Ctrl+K) 3. Highlight search results in document 4. Search across all documents

---

### 4.2 Performance Optimization

**Goal**: Ensure smooth editing with large documents.

**Steps**:

1. Implement virtualization for long documents
2. Lazy load images
3. Optimize Convex queries with pagination
4. Add debouncing for heavy operations

---

## Implementation Order (Recommended)

```
Phase 1 (Foundation)
├── 1.1 Slash Commands Menu       ← Start here
├── 1.2 Block Drag & Drop
└── 1.3 Block Conversions

Phase 2 (Rich Content)
├── 2.1 Inline Formatting Toolbar
├── 2.2 Link Support
└── 2.3 Image/Embed Blocks

Phase 3 (Advanced)
├── 3.1 Nested Pages/Databases
├── 3.2 Collaborative Editing
└── 3.3 Comments & Highlights

Phase 4 (Polish)
├── 4.1 Search
└── 4.2 Performance
```

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
├─────────────────────────────────────────────────────────┤
│  Tiptap Editor                                           │
│  ├── slash-commands.ts    ← Slash menu extension        │
│  ├── block-wrapper.tsx    ← Drag handles                │
│  ├── bubble-menu.tsx      ← Text formatting toolbar     │
│  └── suggestion.ts        ← Autocomplete logic          │
├─────────────────────────────────────────────────────────┤
│  Extensions                                             │
│  ├── UniqueID          (existing)                       │
│  ├── BlockSync         (existing)                       │
│  └── OutlinerKeys      (existing)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (Convex)                      │
├─────────────────────────────────────────────────────────┤
│  blocks.ts              ← CRUD for blocks               │
│  documents.ts           ← Document metadata             │
│  prosemirror-sync.ts    ← Real-time sync (existing)     │
└─────────────────────────────────────────────────────────┘
```

---

## Dependencies to Install

```bash
# For slash commands
npm install @tiptap/suggestion

# For bubble menu
npm install @tiptap/extension-bubble-menu

# For images
npm install @tiptap/extension-image

# For links
npm install @tiptap/extension-link

# For code blocks low-light
npm install highlight.js
```

---

## Success Criteria

A Notion-like editor is complete when:

- [ ] User can type `/` to see a menu of block types
- [ ] User can drag blocks to reorder them
- [ ] User can convert blocks between types
- [ ] User can format text with a floating toolbar
- [ ] User can insert images via upload or URL
- [ ] Document syncs in real-time to Convex
