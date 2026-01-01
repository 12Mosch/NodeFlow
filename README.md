# 🌊 NodeFlow

**NodeFlow** is a modern, local-first, block-based note-taking application and Spaced Repetition System (SRS). It bridges the gap between structured thinking (Outlining) and long-term retention (Flashcards).

Built with a state-of-the-art tech stack, NodeFlow provides a "zero-latency" experience for capturing and organizing knowledge.

---

## ✨ Features

- **Hierarchical Outliner**: Organize your thoughts into nested "Rem" blocks with a powerful Tiptap-based editor.
- **Real-time Sync**: Every keystroke is synchronized instantly using [Convex](https://www.convex.dev/).
- **Block-Based Architecture**: Every piece of content is a granular block, enabling advanced tracking and linking.
- **Local-First Experience**: Optimistic updates ensure the UI feels instantaneous, regardless of network conditions.
- **SRS Integration**: Designed for long-term retention (Flashcard generation from blocks - _In Progress_).
- **Keyboard-First Navigation**: Optimized for speed and efficiency in note-taking.

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack React with deep type safety)
- **Database & Sync**: [Convex](https://www.convex.dev/) (Document-based ACID transactions & real-time subscriptions)
- **Authentication**: [WorkOS](https://workos.com/) (Enterprise-grade user management)
- **Editor**: [Tiptap](https://tiptap.dev/) / ProseMirror (Rich text block-level editing)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **State Management**: [TanStack Query](https://tanstack.com/query) & [Form](https://tanstack.com/form)
- **Monitoring**: [Sentry](https://sentry.io/) (Error tracking and performance)
- **Runtime**: [Bun](https://bun.sh/) (Fastest JavaScript all-in-one toolkit)

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed.
- A [Convex](https://www.convex.dev/) account.
- A [WorkOS](https://workos.com/) project.

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# Convex
VITE_CONVEX_URL=your_convex_url

# WorkOS
VITE_WORKOS_CLIENT_ID=your_workos_client_id
VITE_WORKOS_API_HOSTNAME=your_workos_api_hostname
VITE_WORKOS_REDIRECT_URI=http://localhost:3000/callback

# Sentry (Optional)
VITE_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

> **Note**: For authentication to work in the backend, you must also set `WORKOS_CLIENT_ID` (and optionally `WORKOS_API_HOSTNAME` if you are using a custom one) in your [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

### Installation

```bash
bun install
```

### Development

Start the development server (runs both TanStack Start and Convex dev):

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

---

## 📂 Project Structure

- `app/`: TanStack Start application routes and logic.
- `convex/`: Backend schema and database functions.
- `src/components/`: UI components (including Tiptap editor).
- `src/integrations/`: Third-party service configurations (WorkOS, Sentry).
- `src/extensions/`: Custom Tiptap extensions for block management.

## 🏗️ Building for Production

To build the application for production:

```bash
bun run build
```

The production output will be in the `.output` directory, ready to be served by Nitro.

---

## 🧪 Testing & Linting

```bash
# Run tests
bun run test

# Check for linting/formatting errors
bun run check

# Fix linting/formatting errors
bun run lint
bun run format
```

---

## 📉 Learn More

- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [Convex Documentation](https://docs.convex.dev/home)
- [Tiptap Documentation](https://tiptap.dev/docs)

---

Developed with ❤️ by the NodeFlow Team.
