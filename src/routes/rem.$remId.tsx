import { Suspense } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BlockTree } from '../components/block-editor'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/rem/$remId')({
  component: RemPage,
  errorComponent: () => {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-destructive">Invalid ID</h1>
          <p className="text-muted-foreground">
            The provided block ID is malformed or invalid.
          </p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded shadow hover:opacity-90 transition-opacity mt-4"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  },
})

function RemPage() {
  const { remId } = Route.useParams()

  // Convex IDs are alphanumeric.
  // Basic defensive check to avoid passing junk to Convex queries.
  const isValidPattern = /^[a-z0-9]+$/i.test(remId)

  if (!isValidPattern) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-destructive">Malformed ID</h1>
          <p className="text-muted-foreground">
            The ID "{remId}" is not a valid format.
          </p>
          <Link
            to="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded shadow hover:opacity-90 transition-opacity mt-4"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-8">Loading block tree...</div>}>
        <BlockTree rootId={remId as Id<'blocks'>} />
      </Suspense>
    </div>
  )
}
