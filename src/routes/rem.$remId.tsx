import { createFileRoute } from '@tanstack/react-router'
import { BlockTree } from '../components/block-editor'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/rem/$remId')({
  component: RemPage,
})

function RemPage() {
  const { remId } = Route.useParams()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlockTree rootId={remId as Id<'blocks'>} />
    </div>
  )
}
