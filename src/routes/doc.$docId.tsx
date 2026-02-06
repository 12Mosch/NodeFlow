import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIsRestoring, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { GraduationCap, Redo, Search, Share2, Undo } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Editor } from '@tiptap/core'
import type { Id } from '../../convex/_generated/dataModel'
import type { FlashcardWithDocument } from '@/components/flashcards'
import type { StudyMode } from '@/components/study-mode-dialog'
import type { PresenceUser } from '@/hooks/use-presence'
import { DocumentLearnQuiz } from '@/components/document-learn-quiz'
import { FlashcardQuiz } from '@/components/flashcards'
import { ShareDialog } from '@/components/share-dialog'
import { StudyModeDialog } from '@/components/study-mode-dialog'
import { TiptapEditor } from '@/components/tiptap-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { DocumentSidebar } from '@/components/sidebar'
import { useSearch } from '@/components/search-provider'
import { usePresence } from '@/hooks/use-presence'
import { CollaboratorAvatars } from '@/components/presence/collaborator-avatars'

type DocSearch = {
  q?: string
}

export const Route = createFileRoute('/doc/$docId')({
  component: DocumentPage,
  validateSearch: (search: Record<string, unknown>): DocSearch => {
    return {
      q: typeof search.q === 'string' ? search.q : undefined,
    }
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-lg border p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-destructive">
          Invalid Document
        </h1>
        <p className="text-muted-foreground">
          The document ID is malformed or invalid.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded bg-primary px-6 py-2 text-primary-foreground shadow transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
        >
          Go back home
        </Link>
      </div>
    </div>
  ),
})

function DocumentPage() {
  const { docId } = Route.useParams()

  // Basic ID validation
  const isValidPattern = /^[a-z0-9]+$/i.test(docId)

  if (!isValidPattern) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-lg border p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-destructive">Malformed ID</h1>
          <p className="text-muted-foreground">
            The ID "{docId}" is not a valid format.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded bg-primary px-6 py-2 text-primary-foreground shadow transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <DocumentSidebar>
      <SidebarInset className="min-h-screen bg-background text-foreground">
        <Suspense
          fallback={
            <div className="p-8 text-muted-foreground">Loading document...</div>
          }
        >
          {/* Key forces React to remount when docId changes, avoiding DOM reconciliation issues with Tiptap */}
          <DocumentContent key={docId} docId={docId as Id<'documents'>} />
        </Suspense>
      </SidebarInset>
    </DocumentSidebar>
  )
}

function DocumentContent({ docId }: { docId: Id<'documents'> }) {
  const navigate = useNavigate()
  const isRestoring = useIsRestoring()
  const { q: searchQuery } = Route.useSearch()
  const { data: document, isPending } = useQuery(
    convexQuery(api.documents.get, { id: docId }),
  )
  const { data: flashcards } = useQuery(
    convexQuery(
      api.blocks.listFlashcards,
      document ? { documentId: docId } : 'skip',
    ),
  )
  // Query blocks for instant preview while editor loads
  const { data: blocks } = useQuery(
    convexQuery(
      api.blocks.listByDocument,
      document ? { documentId: docId } : 'skip',
    ),
  )
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isStudying, setIsStudying] = useState(false)
  const [studyMode, setStudyMode] = useState<StudyMode | null>(null)
  const [showStudyModeDialog, setShowStudyModeDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)

  // Presence for collaborative editing
  const { collaborators, updateCursor } = usePresence({ documentId: docId })

  const flashcardCount = flashcards?.length ?? 0

  const handleStudyClick = () => {
    setShowStudyModeDialog(true)
  }

  const initializeCardStates = useMutation(
    api.cardStates.initializeDocumentCardStates,
  )

  const handleSelectStudyMode = async (mode: StudyMode) => {
    if (mode === 'spaced-repetition') {
      // Initialize card states for all flashcards in this document
      // This ensures cards are available for spaced repetition
      try {
        await initializeCardStates({ documentId: docId })
      } catch (error) {
        console.error('Failed to initialize card states:', error)
        toast.warning(
          'Could not initialize card states. Cards will be created on first review.',
        )
        // Continue anyway - card states will be created on first review
      }
    }
    setStudyMode(mode)
    setIsStudying(true)
  }

  // During cache restoration from IndexedDB, wait briefly to see if cached data is available
  // This prevents showing loading/not-found states before we check the persisted cache
  if (isRestoring) {
    return null
  }

  // Show loading only when there's no cached data and we're fetching
  if (isPending) {
    return (
      <div className="p-8 text-muted-foreground">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-sm shadow-xs">
          Loading document...
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-2xl border border-border/70 bg-card/60 px-6 py-14 text-center shadow-xs">
          <h1 className="mb-4 text-3xl font-bold">Document not found</h1>
          <p className="mb-6 text-muted-foreground">
            This document doesn't exist or you don't have access to it.
          </p>
          <Link
            to="/"
            className="rounded-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Go back home
          </Link>
        </div>
      </div>
    )
  }

  // Study mode for this document
  if (isStudying && flashcards && flashcards.length > 0) {
    if (studyMode === 'spaced-repetition') {
      return (
        <div className="mx-auto max-w-4xl p-8">
          <DocumentLearnQuiz
            documentId={docId}
            onBack={() => {
              setIsStudying(false)
              setStudyMode(null)
            }}
            onGoHome={() => navigate({ to: '/' })}
          />
        </div>
      )
    }

    // Random mode (default)
    const documentData: Array<FlashcardWithDocument> = [
      {
        document: { _id: docId, title: document.title },
        flashcards,
      },
    ]

    return (
      <div className="mx-auto max-w-4xl p-8">
        <FlashcardQuiz
          documents={documentData}
          selectedDocIds={new Set([docId])}
          onBack={() => {
            setIsStudying(false)
            setStudyMode(null)
          }}
          onGoHome={() => navigate({ to: '/' })}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      {/* Minimal header */}
      <MinimalHeader
        editor={editor}
        flashcardCount={flashcardCount}
        onStudy={handleStudyClick}
        onShare={() => setShowShareDialog(true)}
        collaborators={collaborators}
      />

      {/* Study mode dialog */}
      <StudyModeDialog
        open={showStudyModeDialog}
        onOpenChange={setShowStudyModeDialog}
        onSelectMode={handleSelectStudyMode}
      />

      {/* Share dialog */}
      <ShareDialog
        documentId={docId}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />

      {/* Document title */}
      <DocumentTitle document={document} />

      {/* Editor - grows to fill remaining space */}
      <div className="flex flex-1 flex-col pb-10">
        <TiptapEditor
          documentId={docId}
          onEditorReady={setEditor}
          previewBlocks={blocks}
          collaborators={collaborators}
          onCursorChange={updateCursor}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  )
}

function MinimalHeader({
  editor,
  flashcardCount,
  onStudy,
  onShare,
  collaborators,
}: {
  editor: Editor | null
  flashcardCount: number
  onStudy: () => void
  onShare: () => void
  collaborators: Array<PresenceUser>
}) {
  const { open: openSearch } = useSearch()
  // Track undo/redo availability reactively
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    if (!editor) {
      // Reset state when editor becomes unavailable
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanUndo(false)

      setCanRedo(false)
      return
    }

    const updateUndoRedo = () => {
      setCanUndo(editor.can().undo())
      setCanRedo(editor.can().redo())
    }

    // Set initial state and subscribe to transactions
    updateUndoRedo()
    editor.on('transaction', updateUndoRedo)

    return () => {
      editor.off('transaction', updateUndoRedo)
    }
  }, [editor])

  return (
    <header className="sticky top-0 z-50 -mx-4 border-b border-border/70 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 lg:-mx-8">
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1.5 shadow-xs">
          {/* Study button - only show if there are flashcards */}
          {flashcardCount > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={onStudy}
                title="Study flashcards"
              >
                <GraduationCap className="h-4 w-4" />
                Study
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {flashcardCount}
                </Badge>
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
            </>
          )}

          {/* Undo/Redo */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!canUndo}
            title="Undo"
            aria-label="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Search button */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            title="Search (Ctrl+F)"
            aria-label="Open search"
            onClick={openSearch}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Share button */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            title="Share"
            onClick={onShare}
            aria-label="Share document"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Collaborator avatars */}
          {collaborators.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <CollaboratorAvatars collaborators={collaborators} />
            </>
          )}

          {/* Theme toggle */}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}

function DocumentTitle({
  document,
}: {
  document: { _id: Id<'documents'>; title: string }
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(document.title)
  const updateTitle = useMutation(api.documents.updateTitle)
  const queryClient = useQueryClient()
  const isSavingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    await Sentry.startSpan(
      { name: 'DocumentTitle.updateTitle', op: 'ui.interaction' },
      async () => {
        await updateTitle({ id: document._id, title: title || 'Untitled' })
        setIsEditing(false)
        // Invalidate the document list query to update the sidebar
        await queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      },
    )
    isSavingRef.current = false
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(document.title)
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    if (!isSavingRef.current) {
      handleSave()
    }
  }

  const handleClick = () => {
    setTitle(document.title)
    setIsEditing(true)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Ref callback to focus input when mounted and store ref for blur handling
  const inputRefCallback = (node: HTMLInputElement | null) => {
    inputRef.current = node
    node?.focus()
  }

  return (
    <div className="pt-8 pb-4 sm:pt-10">
      <p className="nf-meta-label mb-2 text-muted-foreground">Document</p>
      {isEditing ? (
        <input
          ref={inputRefCallback}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="nf-type-display w-full rounded-md bg-transparent pb-1 text-4xl text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-5xl"
          placeholder="Untitled"
        />
      ) : (
        <h1
          onClick={handleClick}
          onKeyDown={handleTitleKeyDown}
          tabIndex={0}
          role="button"
          className="nf-type-display -mx-2 cursor-text rounded-lg px-2 pb-1 text-4xl text-foreground transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none sm:text-5xl"
        >
          {document.title || 'Untitled'}
        </h1>
      )}
    </div>
  )
}
