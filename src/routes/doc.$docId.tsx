import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { GraduationCap, Redo, Share2, Undo } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Editor } from '@tiptap/core'
import type { Id } from '../../convex/_generated/dataModel'
import type { FlashcardWithDocument } from '@/components/flashcards'
import { TiptapEditor } from '@/components/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/mode-toggle'
import { FlashcardQuiz } from '@/components/flashcards'

export const Route = createFileRoute('/doc/$docId')({
  component: DocumentPage,
  errorComponent: () => (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-destructive">
          Invalid Document
        </h1>
        <p className="text-muted-foreground">
          The document ID is malformed or invalid.
        </p>
        <Link
          to="/"
          className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded shadow hover:opacity-90 transition-opacity mt-4"
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-destructive">Malformed ID</h1>
          <p className="text-muted-foreground">
            The ID "{docId}" is not a valid format.
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
      <Suspense
        fallback={
          <div className="p-8 text-muted-foreground">Loading document...</div>
        }
      >
        <DocumentContent docId={docId as Id<'documents'>} />
      </Suspense>
    </div>
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

  const flashcardCount = flashcards?.length ?? 0

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading document...</div>
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Document not found</h1>
        <p className="text-muted-foreground mb-6">
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
    const documentData: Array<FlashcardWithDocument> = [
      {
        document: { _id: docId, title: document.title },
        flashcards,
        count: flashcards.length,
      },
    ]

    return (
      <div className="max-w-4xl mx-auto p-8">
        <FlashcardQuiz
          documents={documentData}
          selectedDocIds={new Set([docId])}
          onBack={() => setIsStudying(false)}
          onGoHome={() => navigate({ to: '/' })}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Minimal header */}
      <MinimalHeader
        editor={editor}
        flashcardCount={flashcardCount}
        onStudy={() => setIsStudying(true)}
      />

      {/* Document title */}
      <DocumentTitle document={document} />

      {/* Editor without border wrapper */}
      <div className="px-8 pb-8">
        <TiptapEditor documentId={docId} onEditorReady={setEditor} />
      </div>
    </div>
  )
}

function MinimalHeader({
  editor,
  flashcardCount,
  onStudy,
}: {
  editor: Editor | null
  flashcardCount: number
  onStudy: () => void
}) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-end gap-1 px-4 py-2">
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
            <div className="w-px h-4 bg-border mx-1" />
          </>
        )}

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Share button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Theme toggle */}
        <ModeToggle />
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
  const isSavingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync title state when document.title changes externally
  useEffect(() => {
    if (!isEditing) {
      setTitle(document.title)
    }
  }, [document.title, isEditing])

  const handleSave = async () => {
    await Sentry.startSpan(
      { name: 'DocumentTitle.updateTitle', op: 'ui.interaction' },
      async () => {
        await updateTitle({ id: document._id, title: title || 'Untitled' })
        setIsEditing(false)
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
    <div className="px-8 pt-8 pb-2">
      {isEditing ? (
        <input
          ref={inputRefCallback}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full text-3xl font-bold bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          placeholder="Untitled"
        />
      ) : (
        <h1
          onClick={handleClick}
          onKeyDown={handleTitleKeyDown}
          tabIndex={0}
          role="button"
          className="text-3xl font-bold text-foreground cursor-text hover:bg-accent/50 focus:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-1 -mx-1 transition-colors"
        >
          {document.title || 'Untitled'}
        </h1>
      )}
    </div>
  )
}
