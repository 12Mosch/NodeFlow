import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { GraduationCap, Redo, Share2, Undo } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Editor } from '@tiptap/core'
import type { Id } from '../../convex/_generated/dataModel'
import type { FlashcardWithDocument } from '@/components/flashcards'
import type { StudyMode } from '@/components/study-mode-dialog'
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

export const Route = createFileRoute('/doc/$docId')({
  component: DocumentPage,
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
          className="mt-4 inline-block rounded bg-primary px-6 py-2 text-primary-foreground shadow transition-opacity hover:opacity-90"
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
            className="mt-4 inline-block rounded bg-primary px-6 py-2 text-primary-foreground shadow transition-opacity hover:opacity-90"
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
  const { data: document, isLoading } = useQuery({
    ...convexQuery(api.documents.get, { id: docId }),
  })
  const { data: flashcards } = useQuery({
    ...convexQuery(api.blocks.listFlashcards, { documentId: docId }),
    enabled: !!document,
  })
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isStudying, setIsStudying] = useState(false)
  const [studyMode, setStudyMode] = useState<StudyMode | null>(null)
  const [showStudyModeDialog, setShowStudyModeDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)

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

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading document...</div>
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Document not found</h1>
        <p className="mb-6 text-muted-foreground">
          This document doesn't exist or you don't have access to it.
        </p>
        <Link to="/" className="text-primary hover:underline">
          Go back home
        </Link>
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
      <div className="flex flex-1 flex-col pb-8">
        <TiptapEditor documentId={docId} onEditorReady={setEditor} />
      </div>
    </div>
  )
}

function MinimalHeader({
  editor,
  flashcardCount,
  onStudy,
  onShare,
}: {
  editor: Editor | null
  flashcardCount: number
  onStudy: () => void
  onShare: () => void
}) {
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
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-1 px-4 py-2">
        <SidebarTrigger />
        <div className="flex items-center gap-1">
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
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Share button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Share"
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" />
          </Button>

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
    <div className="pt-8 pb-2">
      {isEditing ? (
        <input
          ref={inputRefCallback}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Untitled"
        />
      ) : (
        <h1
          onClick={handleClick}
          onKeyDown={handleTitleKeyDown}
          tabIndex={0}
          role="button"
          className="-mx-1 cursor-text rounded px-1 text-3xl font-bold text-foreground transition-colors hover:bg-accent/50 focus:bg-accent/50 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
        >
          {document.title || 'Untitled'}
        </h1>
      )}
    </div>
  )
}
