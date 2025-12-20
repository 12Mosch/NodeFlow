## 1. Project Vision

A highly interactive, local-first, block-based note-taking and Spaced Repetition System (SRS) application. The goal is to bridge the gap between structured thinking (Outlining) and long-term retention (Flashcards).

## 2. Core Tech Stack

- **Framework:** `TanStack Start` (Full-stack React framework with deep type safety).
- **Database & Backend:** `Convex` (Real-time sync, document-based, ACID transactions).
- **Deployment/Server:** `Nitro` (Underlying server engine for TanStack Start).
- **Authentication:** `WorkOS` (Enterprise-grade auth and user management).
- **Data Fetching:** `TanStack Query` (Integrated with Convex for prefetching and caching).
- **State & Forms:** `TanStack Form` (Type-safe form management for settings and metadata).
- **UI Components:** `Shadcn UI` (Radix UI + Tailwind CSS).
- **Monitoring:** `Sentry` (Error tracking and performance monitoring).
- **Optimization:** `React Compiler` (Enabled for automatic memoization).

## 3. Architecture & Data Flow

### **Data Layer (Convex)**

- **Real-time:** Every query is a subscription. Changes in the DB reflect instantly in the UI.
- **Schema:** Defined in `convex/schema.ts`. Primarily hierarchical "Rem" blocks.
- **Logic:** Mutations handled via Convex functions to ensure atomic updates for nested structures.

### **Routing & Prefetching (TanStack Start)**

- Uses **TanStack Query** to prefetch data on the server (SSR) to ensure fast initial page loads.
- **Loaders** in TanStack Start should trigger Convex queries to populate the cache.

### **Auth (WorkOS)**

- Integrated via middleware to protect routes.
- User identity is synced/linked within Convex to manage personal data ownership.

## 4. Engineering Standards

- **Type Safety:** Strict TypeScript everywhere. Use `zod` for validation in forms and API boundaries.
- **Performance:**
- Leverage the **React Compiler** to avoid manual `useMemo` and `useCallback`.
- Use **Optimistic Updates** in Convex/Query for a "zero-latency" feel during typing.

- **UI/UX:**
- Follow the **Shadcn** design patterns for consistency.
- Focus on keyboard-first navigation (essential for outliners).

- **Linting:** ESLint with strict rules for React and TanStack hooks.

## 5. Key Features to Implement

1. **Hierarchical Outliner:** Nested blocks ("Rems") with parent-child relationships.
2. **Flashcard Engine:** Automatic card generation from specific block types (e.g., using `::` or `==` syntax).
3. **Spaced Repetition:** Algorithm (FSRS or SM-2) running on Convex to schedule reviews.
4. **Global Search:** Ultra-fast, indexed search across all blocks.

## 6. Development Commands

- `dev`: Starts the TanStack Start and Convex dev servers.
- `build`: Production build using Nitro.
- `lint`: Run ESLint check.

## 7. Instructions

- **Context:** When generating code, always prioritize **Type-Safe** solutions.
- **TanStack Start:** Use the latest file-based routing conventions.
- **Shadcn:** When asked for new UI, prefer using existing Shadcn components or creating new ones in the `@/components/ui` pattern.
