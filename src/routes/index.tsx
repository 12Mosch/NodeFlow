import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvex, useConvexAuth, useMutation } from 'convex/react'
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
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { InfiniteData } from '@tanstack/react-query'
import type { StudyMode } from '@/components/study-mode-dialog'
import { useDocumentList } from '@/hooks/use-document-list'
import { ModeToggle } from '@/components/mode-toggle'
import { StudyModeDialog } from '@/components/study-mode-dialog'
import { Button } from '@/components/ui/button'

const DOCUMENTS_PER_PAGE = 10

type DocumentPage = {
  page: Array<Doc<'documents'>>
  continueCursor: string
  isDone: boolean
}

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
  const convex = useConvex()
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
  const deleteDocument = useMutation(api.documents.deleteDocument)
  const navigate = useNavigate()
  const [isStudyDialogOpen, setIsStudyDialogOpen] = useState(false)
  const { queryClient } = Route.useRouteContext()

  // Prefetch data once authentication is available client-side
  // This waits for authentication before attempting to prefetch, ensuring
  // the query succeeds and populates the TanStack Query cache
  useEffect(() => {
    if (isAuthenticated) {
      // Prefetch into TanStack Query cache for better performance
      queryClient.ensureInfiniteQueryData({
        queryKey: ['documents', 'list', DOCUMENTS_PER_PAGE],
        queryFn: async ({ pageParam }) => {
          return await convex.query(api.documents.list, {
            paginationOpts: {
              numItems: DOCUMENTS_PER_PAGE,
              cursor: pageParam,
            },
          })
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: DocumentPage) =>
          lastPage.isDone ? null : lastPage.continueCursor,
      })
    }
  }, [isAuthenticated, queryClient, convex])

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
      <div className="flex h-screen items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading documents...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-destructive">
        Error loading documents: {queryError.message || 'Unknown error'}
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

      {documents.length === 0 ? (
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

          {(hasNextPage || isFetchingNextPage) && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {isFetchingNextPage ? 'Loading more...' : 'Load More'}
              </Button>
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
