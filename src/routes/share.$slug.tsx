import { Suspense } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { PublicDocumentViewer } from '@/components/public-document-viewer'
import { TiptapEditor } from '@/components/tiptap-editor'

export const Route = createFileRoute('/share/$slug')({
  component: SharedDocumentPage,
  head: async ({ params }) => {
    // Import server-only utilities inside the head function to avoid client bundling
    const { getRequest } = await import('@tanstack/react-start/server')
    const req = getRequest()

    // Derive origin in a server-safe way
    let origin = ''
    try {
      origin = new URL(req.url).origin
    } catch {
      // Fall back to building origin from headers
      const proto =
        req.headers.get('x-forwarded-proto') ??
        req.headers.get('x-forwarded-protocol') ??
        'https'
      const host = req.headers.get('host') ?? ''
      origin = host ? `${proto}://${host}` : ''
    }

    return {
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
          content: `${origin}/share/${params.slug}`,
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
    }
  },
})

function SharedDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-lg text-muted-foreground">
            Loading...
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-destructive">
            Document Not Found
          </h1>
          <p className="text-muted-foreground">
            This link may have expired or the document is no longer shared.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded bg-primary px-6 py-2 text-primary-foreground shadow transition-opacity hover:opacity-90"
          >
            Go to NodeFlow
          </Link>
        </div>
      </div>
    )
  }

  const isReadOnly = document.permission === 'view'

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Public header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:underline"
            >
              NodeFlow
            </Link>
            <h1 className="text-xl font-bold">{document.title}</h1>
          </div>
          <Badge variant={isReadOnly ? 'secondary' : 'default'}>
            {isReadOnly ? 'View only' : 'Can edit'}
          </Badge>
        </div>
      </header>

      {/* Document content */}
      <div className="py-8">
        {isReadOnly ? (
          <PublicDocumentViewer documentId={document._id} />
        ) : (
          <TiptapEditor documentId={document._id} />
        )}
      </div>
    </div>
  )
}
