import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { ArrowLeft, Check, Pencil } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { TiptapEditor } from '@/components/tiptap-editor'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'

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
  const { data: document, isLoading } = useQuery({
    ...convexQuery(api.documents.get, { id: docId }),
  })

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

  return (
    <div className="max-w-4xl mx-auto">
      <DocumentHeader document={document} />
      <div className="px-8 pb-8">
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <TiptapEditor documentId={docId} />
        </div>
      </div>
    </div>
  )
}

function DocumentHeader({
  document,
}: {
  document: { _id: Id<'documents'>; title: string }
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(document.title)
  const updateTitle = useMutation(api.documents.updateTitle)
  const isSavingRef = useRef(false)

  // Sync title state when document.title changes externally
  useEffect(() => {
    if (!isEditing) {
      setTitle(document.title)
    }
  }, [document.title, isEditing])

  const handleSave = async () => {
    await Sentry.startSpan(
      { name: 'DocumentHeader.updateTitle', op: 'ui.interaction' },
      async () => {
        await updateTitle({ id: document._id, title: title || 'Untitled' })
        setIsEditing(false)
      },
    )
    // Reset ref after save completes so blur can work normally next time
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
    // Only save on blur if we're not already saving from button click
    // onMouseDown fires before onBlur, so the ref will be set if button was clicked
    if (!isSavingRef.current) {
      handleSave()
    }
  }

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    // Set ref before blur fires (onMouseDown fires before onBlur)
    // This prevents handleBlur from also calling handleSave
    isSavingRef.current = true
    handleSave()
  }

  return (
    <div className="flex items-center gap-4 p-8 pb-4">
      <Link to="/">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>
      <div className="flex-1 flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              autoFocus
              className="text-2xl font-bold bg-transparent border-b border-border focus:border-primary outline-none flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={handleButtonMouseDown}
            >
              <Check className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">
              {document.title || 'Untitled'}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="opacity-50 hover:opacity-100"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      <ModeToggle />
    </div>
  )
}
