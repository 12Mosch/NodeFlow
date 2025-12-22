import { Suspense } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <div className="p-8 text-muted-foreground">Loading documents...</div>
        }
      >
        <DocumentList />
      </Suspense>
    </div>
  )
}

function DocumentList() {
  const { data: documents } = useSuspenseQuery(
    convexQuery(api.documents.list, {}),
  )
  const createDocument = useMutation(api.documents.create)
  const deleteDocument = useMutation(api.documents.deleteDocument)
  const navigate = useNavigate()

  const handleCreate = async () => {
    await Sentry.startSpan(
      { name: 'DocumentList.create', op: 'ui.interaction' },
      async () => {
        const id = await createDocument({})
        navigate({ to: '/doc/$docId', params: { docId: id } })
      },
    )
  }

  const handleDelete = async (id: Id<'documents'>, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await Sentry.startSpan(
      { name: 'DocumentList.delete', op: 'ui.interaction' },
      async () => {
        await deleteDocument({ id })
      },
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">No documents yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first document to get started.
          </p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Document
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Link
              key={doc._id}
              to="/doc/$docId"
              params={{ docId: doc._id }}
              className="group flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-medium group-hover:text-accent-foreground">
                    {doc.title || 'Untitled'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Updated {formatDate(doc.updatedAt)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => handleDelete(doc._id, e)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}
