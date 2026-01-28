# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run dev      # Start dev server (TanStack Start + Convex) on port 3000
bun run build    # Build for production
bun run test     # Run Vitest tests
bun run check    # Format + lint fix (Prettier + ESLint)
bun run lint     # ESLint only
bun run format   # Prettier only
```

To run a single test file: `bun run test src/path/to/file.test.ts`

## Tech Stack

- **Framework**: TanStack Start (full-stack React metaframework with Vite + Nitro)
- **Database**: Convex (serverless, real-time subscriptions, ACID transactions)
- **Auth**: WorkOS via `@convex-dev/workos`
- **Editor**: Tiptap v3 (ProseMirror-based rich text)
- **UI**: Shadcn UI + Tailwind CSS 4 + Base UI
- **State**: TanStack Query with `@convex-dev/react-query` for SSR
- **SRS**: ts-fsrs (FSRS v5 algorithm for spaced repetition)
- **Monitoring**: Sentry

## Architecture

### Block-Based Document Model

Every document consists of granular **blocks** stored individually in Convex. Each block has:

- `nodeId`: Unique identifier for tracking
- `type`: ProseMirror node type (paragraph, heading, etc.)
- `content`: Full ProseMirror JSON node
- `textContent`: Plain text for search
- Flashcard fields: `isCard`, `cardType`, `cardDirection`, `cardFront`, `cardBack`, `clozeOcclusions`

### Data Flow

1. **Convex queries are subscriptions** - they automatically update on changes
2. **Optimistic updates** - UI updates immediately via `.withOptimisticUpdate()`
3. **Real-time sync** - `@convex-dev/prosemirror-sync` handles bidirectional editor state sync
4. **SSR prefetching** - TanStack Query + `convexQuery()` helper hydrates data server-side

### Key Directories

- `src/routes/` - TanStack Router file-based routes
- `src/extensions/` - Custom Tiptap extensions (block-sync, slash-commands, unique-id, outliner-keys)
- `src/integrations/` - Provider setup for Convex, WorkOS, TanStack Query
- `convex/` - Backend functions (queries, mutations, actions) and schema

### Database Schema (convex/schema.ts)

Tables: `users`, `documents`, `blocks`, `cardStates`, `reviewLogs`, `files`

Key patterns:

- `userId` is denormalized on blocks for efficient querying
- Cards have separate `cardStates` entries per direction (forward/reverse)
- `reviewLogs` provides audit trail for analytics

## Convex Patterns

### Queries with TanStack Query

```tsx
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

const { data } = useQuery(convexQuery(api.blocks.get, { parentId }))
```

### Mutations (use convex/react, not react-query)

```tsx
import { useMutation } from 'convex/react'
const update = useMutation(api.blocks.update).withOptimisticUpdate(...)
```

### Auth in Backend Functions

```ts
import { mutation } from './_generated/server'
import { requireDocumentAccess } from './helpers/documentAccess'

export const myMutation = mutation({
  handler: async (ctx, args) => {
    // requireDocumentAccess calls requireUser internally
    const { document, userId } = await requireDocumentAccess(
      ctx,
      args.documentId,
    )
    // ...
  },
})
```

## Sentry Instrumentation

Wrap server function implementations with spans:

```ts
import * as Sentry from '@sentry/tanstackstart-react'

Sentry.startSpan({ name: 'Operation name' }, async () => {
  // operation
})
```

## Adding UI Components

```bash
bunx shadcn@latest add <component>
```
