import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { toast } from 'sonner'
import {
  ChevronDown,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { StudyMode } from '@/components/study-mode-dialog'
import { ModeToggle } from '@/components/mode-toggle'
import { StudyModeDialog } from '@/components/study-mode-dialog'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DocumentList />
    </div>
  )
}

function DocumentList() {
  const {
    results: documents,
    status,
    loadMore,
  } = usePaginatedQuery(api.documents.list, {}, { initialNumItems: 10 })
  const createDocument = useMutation(api.documents.create)
  const deleteDocument = useMutation(api.documents.deleteDocument)
  const navigate = useNavigate()
  const [isStudyDialogOpen, setIsStudyDialogOpen] = useState(false)

  const handleCreate = async () => {
    try {
      await Sentry.startSpan(
        { name: 'DocumentList.create', op: 'ui.interaction' },
        async () => {
          const id = await createDocument({})
          navigate({ to: '/doc/$docId', params: { docId: id } })
        },
      )
    } catch (error) {
      toast.error('Failed to create document. Please try again.')
      console.error('Error creating document:', error)
    }
  }

  const handleDelete = async (id: Id<'documents'>, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await Sentry.startSpan(
        { name: 'DocumentList.delete', op: 'ui.interaction' },
        async () => {
          await deleteDocument({ id })
        },
      )
    } catch (error) {
      toast.error('Failed to delete document. Please try again.')
      console.error('Error deleting document:', error)
    }
  }

  const handleSelectStudyMode = (mode: StudyMode) => {
    navigate({ to: '/study', search: { mode } })
  }

  if (status === 'LoadingFirstPage') {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading documents...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents</h1>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsStudyDialogOpen(true)}
          >
            <GraduationCap className="h-4 w-4" />
            Study
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>
      </div>

      {documents.length === 0 && status === 'Exhausted' ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-medium">No documents yet</h2>
          <p className="mb-6 text-muted-foreground">
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
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
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
                className="text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => handleDelete(doc._id, e)}
                aria-label="Delete document"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          ))}

          {status === 'CanLoadMore' && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadMore(10)}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Load More
              </Button>
            </div>
          )}

          {status === 'LoadingMore' && (
            <div className="mt-4 flex justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading more...
            </div>
          )}
        </div>
      )}

      <StudyModeDialog
        open={isStudyDialogOpen}
        onOpenChange={setIsStudyDialogOpen}
        onSelectMode={handleSelectStudyMode}
      />
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
