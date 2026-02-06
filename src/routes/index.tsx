import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { toast } from 'sonner'
import {
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { InfiniteData } from '@tanstack/react-query'
import type { StudyMode } from '@/components/study-mode-dialog'
import type { DocumentPage } from '@/hooks/use-document-list'
import { useDocumentList } from '@/hooks/use-document-list'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { ModeToggle } from '@/components/mode-toggle'
import { StudyModeDialog } from '@/components/study-mode-dialog'
import { Button } from '@/components/ui/button'
import { useSearch } from '@/components/search-provider'

const DOCUMENTS_PER_PAGE = 10

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DocumentList />
    </div>
  )
}

function DocumentList() {
  const { isAuthenticated } = useConvexAuth()
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: queryError,
  } = useDocumentList({ numItems: DOCUMENTS_PER_PAGE })

  const documents = data?.pages.flatMap((p: DocumentPage) => p.page) || []
  const createDocument = useMutation(api.documents.create)

  const sentinelRef = useIntersectionObserver({
    onIntersect: () => fetchNextPage(),
    enabled: hasNextPage && !isFetchingNextPage,
  })
  const deleteDocument = useMutation(api.documents.deleteDocument)
  const navigate = useNavigate()
  const [isStudyDialogOpen, setIsStudyDialogOpen] = useState(false)
  const { open: openSearch } = useSearch()
  const { queryClient } = Route.useRouteContext()

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

    // Capture current data for rollback
    const previousData = queryClient.getQueryData([
      'documents',
      'list',
      DOCUMENTS_PER_PAGE,
    ])

    try {
      await Sentry.startSpan(
        { name: 'DocumentList.delete', op: 'ui.interaction' },
        async () => {
          await deleteDocument.withOptimisticUpdate(() => {
            // Manually update the TanStack Query cache for the infinite query
            queryClient.setQueryData<InfiniteData<DocumentPage, string | null>>(
              ['documents', 'list', DOCUMENTS_PER_PAGE],
              (oldData) => {
                if (!oldData) return oldData
                return {
                  ...oldData,
                  pages: oldData.pages.map((page) => ({
                    ...page,
                    page: page.page.filter((doc) => doc._id !== id),
                  })),
                }
              },
            )
          })({ id })
          toast.success('Document deleted')
        },
      )
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(
        ['documents', 'list', DOCUMENTS_PER_PAGE],
        previousData,
      )
      toast.error('Failed to delete document. Please try again.')
      console.error('Error deleting document:', error)
    }
  }

  const handleSelectStudyMode = (mode: StudyMode) => {
    navigate({ to: '/study', search: { mode } })
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-muted-foreground">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 shadow-xs">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          <span>Loading documents...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-xs">
          Error loading documents: {queryError.message || 'Unknown error'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-40 -mx-4 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8">
          <div className="space-y-2 lg:max-w-2xl xl:max-w-3xl">
            <p className="nf-meta-label text-muted-foreground">Workspace</p>
            <h1 className="nf-type-display text-4xl text-foreground sm:text-5xl">
              Documents
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Capture ideas and iterate quickly from one consistent workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-xs lg:ml-auto lg:shrink-0">
            <ModeToggle />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={openSearch}
              title="Search (Ctrl+F)"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsStudyDialogOpen(true)}
            >
              <GraduationCap className="h-4 w-4" />
              Study
            </Button>
            <Button size="sm" onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 py-6 sm:py-8">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center shadow-xs">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-2xl font-semibold text-foreground">
              No documents yet
            </h2>
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
              <div
                key={doc._id}
                className="group flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3.5 shadow-xs transition-colors hover:bg-accent/50 motion-reduce:transition-none"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground motion-reduce:transition-none">
                    <FileText className="h-4 w-4" />
                  </div>
                  <Link
                    to="/doc/$docId"
                    params={{ docId: doc._id }}
                    className="min-w-0 flex-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                  >
                    <h3 className="truncate font-medium text-foreground">
                      {doc.title || 'Untitled'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Updated {formatDate(doc.updatedAt)}
                    </p>
                  </Link>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-destructive opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive motion-reduce:transition-none"
                  onClick={(e) => handleDelete(doc._id, e)}
                  aria-label="Delete document"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}

            {hasNextPage && <div ref={sentinelRef} className="h-1" />}
            {isFetchingNextPage && (
              <div className="mt-4 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
              </div>
            )}
          </div>
        )}
      </div>

      <StudyModeDialog
        open={isStudyDialogOpen}
        onOpenChange={setIsStudyDialogOpen}
        onSelectMode={handleSelectStudyMode}
      />
    </div>
  )
}

function formatDate(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return 'unknown'
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return 'unknown'
  }

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
