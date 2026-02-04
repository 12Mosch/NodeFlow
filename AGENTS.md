# Repository Guidelines

## Project Structure

Use these directories to place new code and locate existing modules.

- `src/routes/` for TanStack Router file-based routes (example: `src/routes/doc.$docId.tsx`).
- `src/components/` for UI components and editor pieces.
- `src/extensions/` for custom Tiptap/ProseMirror extensions.
- `src/integrations/` for service wiring (Convex, WorkOS, Sentry, TanStack Query).
- `src/lib/` and `src/hooks/` for shared utilities and hooks.
- `convex/` for backend schema and functions. Do not edit `convex/_generated/`.
- `public/` for static assets. Production output is emitted to `.output/`.

## Tech Stack

Use this stack when choosing libraries or patterns so changes stay consistent.

- **Framework**: TanStack Start (Vite + Nitro)
- **Database**: Convex (real-time, ACID transactions)
- **Auth**: WorkOS via `@convex-dev/workos`
- **Editor**: Tiptap v3 (ProseMirror-based)
- **UI**: Shadcn UI + Tailwind CSS 4 + Base UI
- **State**: TanStack Query with `@convex-dev/react-query` for SSR
- **SRS**: ts-fsrs (FSRS v5 algorithm)
- **Monitoring**: Sentry

## Development Commands

Run project scripts with Bun.

- `bun run dev` to start Vite + Convex dev servers on port 3000.
- `bun run build` to create a production build (Vite + server instrumentation).
- `bun run preview` to preview the production build.
- `bun run start` to run the Nitro server from `.output/`.
- `bun run test` to run Vitest once.
- `bun run typecheck` for TypeScript checks only.
- `bun run lint` for ESLint only.
- `bun run format` for Prettier only.
- `bun run check` to format, fix lint, and typecheck (modifies files).

## Coding Style & Naming

Follow these conventions to match existing code style.

- Use TypeScript with ESM (`"type": "module"`).
- Let Prettier drive formatting: single quotes, no semicolons, trailing commas.
- Follow ESLint (TanStack + React hooks + Vitest rules).
- Name components `PascalCase`, hooks `useSomething`, utilities `kebab` or `camelCase` per file.
- Do not edit generated files like `src/routeTree.gen.ts` or `convex/_generated/`.

## Testing

Write tests and run them from the same directories as the code under test.

- Use Vitest with Testing Library.
- Name test files `*.test.ts` next to the implementation.
- Run a single file with `bun run test src/lib/flashcard-parser.test.ts`.

## Commits & Pull Requests

Keep history and PRs easy to scan and easy to verify.

- Use `<Type>: <Summary>` commit messages (example: `Feat: Add leech detection`).
- Keep summaries imperative and scoped. Add PR numbers when applicable.
- Include what changed, how to test, and screenshots for UI changes.
- Before finishing a task, run `bun run check` and `bun run test`.
