import { Suspense, useSyncExternalStore } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { PresenceUser } from '@/hooks/use-presence'
import { Badge } from '@/components/ui/badge'
import { PublicDocumentViewer } from '@/components/public-document-viewer'
import { TiptapEditor } from '@/components/tiptap-editor'
import { usePresence } from '@/hooks/use-presence'
import { CollaboratorAvatars } from '@/components/presence/collaborator-avatars'

const getOrigin = createServerFn({ method: 'GET' }).handler(() => {
  const request = getRequest()
  // Derive origin in a server-safe way from the request
  let origin = ''
  try {
    origin = new URL(request.url).origin
  } catch {
    // Fall back to building origin from headers
    const proto =
      request.headers.get('x-forwarded-proto') ??
      request.headers.get('x-forwarded-protocol') ??
      'https'
    const host = request.headers.get('host') ?? ''
    origin = host ? `${proto}://${host}` : ''
  }
  return origin
})

export const Route = createFileRoute('/share/$slug')({
  component: SharedDocumentPage,
  loader: async () => {
    const origin = await getOrigin()
    return { origin }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: 'Shared Document - NodeFlow',
      },
      {
        name: 'description',
        content: 'View a shared document on NodeFlow',
      },
      // Open Graph tags for social media sharing
      {
        property: 'og:type',
        content: 'article',
      },
      {
        property: 'og:title',
        content: 'Shared Document - NodeFlow',
      },
      {
        property: 'og:description',
        content: 'View a shared document on NodeFlow',
      },
      {
        property: 'og:url',
        content: `${loaderData?.origin ?? ''}/share/${params.slug}`,
      },
      // Twitter Card tags
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: 'Shared Document - NodeFlow',
      },
      {
        name: 'twitter:description',
        content: 'View a shared document on NodeFlow',
      },
    ],
  }),
})

function SharedDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-xs">
            Loading shared document...
          </div>
        </div>
      }
    >
      <SharedDocumentContent />
    </Suspense>
  )
}

function SharedDocumentContent() {
  const { slug } = Route.useParams()

  const { data: document } = useSuspenseQuery(
    convexQuery(api.documents.getPublic, { slug }),
  )

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/70 px-6 py-12 text-center shadow-xs">
          <p className="nf-meta-label text-muted-foreground">Public Share</p>
          <h1 className="nf-type-display mt-2 text-4xl text-destructive sm:text-5xl">
            Document Not Found
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            This link may have expired or the document is no longer shared.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
          >
            Go to NodeFlow
          </Link>
        </div>
      </div>
    )
  }

  return <SharedDocumentWithPresence document={document} />
}

type SharedDocument = {
  _id: Id<'documents'>
  title: string
  permission: 'view' | 'edit'
}

const sharedDocumentPagePaddingClass = 'px-4 sm:px-6 lg:px-8'
const sharedDocumentPageBreakoutClass = '-mx-4 sm:-mx-6 lg:-mx-8'

function SharedDocumentWithPresence({
  document,
}: {
  document: SharedDocument
}) {
  const { collaborators, updateCursor } = usePresence({
    documentId: document._id,
    isAnonymous: true,
  })

  const handleCursorChange = (
    position: number,
    selectionFrom: number,
    selectionTo: number,
  ) => {
    updateCursor(position, selectionFrom, selectionTo)
  }

  const isReadOnly = document.permission === 'view'

  return (
    <div
      className={`mx-auto flex min-h-screen w-full max-w-6xl flex-col ${sharedDocumentPagePaddingClass}`}
    >
      <header
        className={`sticky top-0 z-50 ${sharedDocumentPageBreakoutClass} border-b border-border/70 bg-background/95 py-4 backdrop-blur supports-backdrop-filter:bg-background/80 ${sharedDocumentPagePaddingClass}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="nf-meta-label text-muted-foreground">Public Share</p>
            <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
              {document.title}
            </h1>
            <Link
              to="/"
              className="inline-flex rounded-sm text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
            >
              NodeFlow
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-xs">
            {collaborators.length > 0 && (
              <CollaboratorAvatars collaborators={collaborators} />
            )}
            <Badge variant={isReadOnly ? 'secondary' : 'default'}>
              {isReadOnly ? 'View only' : 'Can edit'}
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex-1 py-6 sm:py-8">
        {isReadOnly ? (
          <PublicDocumentViewer documentId={document._id} />
        ) : (
          <ClientOnlyEditor
            documentId={document._id}
            collaborators={collaborators}
            onCursorChange={handleCursorChange}
          />
        )}
      </div>
    </div>
  )
}

// Helpers for useSyncExternalStore to detect client-side rendering
const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

/**
 * Wrapper to render TiptapEditor only on the client.
 * This is necessary because @convex-dev/prosemirror-sync uses sessionStorage
 * which doesn't exist during server-side rendering.
 */
function ClientOnlyEditor({
  documentId,
  collaborators,
  onCursorChange,
}: {
  documentId: Id<'documents'>
  collaborators?: Array<PresenceUser>
  onCursorChange?: (
    position: number,
    selectionFrom: number,
    selectionTo: number,
  ) => void
}) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  )

  if (!isClient) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border/70 bg-card/50 text-muted-foreground shadow-xs">
        Loading editor...
      </div>
    )
  }

  return (
    <TiptapEditor
      documentId={documentId}
      collaborators={collaborators}
      onCursorChange={onCursorChange}
    />
  )
}
