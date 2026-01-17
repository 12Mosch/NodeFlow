'use client'

import { useMemo } from 'react'
import { EditorContent, EditorProvider, useCurrentEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Mathematics } from '@tiptap/extension-mathematics'
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ExtendedImage } from '@/extensions/image'
import { Callout } from '@/extensions/callout'
import { UniqueID } from '@/extensions/unique-id'
import { FlashcardDecorations } from '@/extensions/flashcard-decorations'

interface PublicDocumentViewerProps {
  documentId: Id<'documents'>
}

export function PublicDocumentViewer({
  documentId,
}: PublicDocumentViewerProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId)
  const { isLoading, initialContent, extension } = sync

  // Memoize extensions array (read-only version, no slash commands or file handler)
  const extensions = useMemo(() => {
    const baseExtensions = [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      // Text styling extensions
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      // Image extension (read-only)
      ExtendedImage.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
        allowBase64: false,
      }),
      Superscript,
      Subscript,
      // Mathematics extension (read-only, no onClick handlers)
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      }),
      // Callout block extension
      Callout,
      // Unique ID extension
      UniqueID,
      // Flashcard decorations (read-only)
      FlashcardDecorations,
    ]

    // Add ProseMirror sync extension if available (using spread to avoid type issues)
    return extension ? [...baseExtensions, extension] : baseExtensions
  }, [extension])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading document...
        </div>
      </div>
    )
  }

  // Handle case where document content hasn't been initialized yet
  // This component is read-only, so we can't create the document
  if (!initialContent) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">
            This document hasn't been initialized yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The document owner needs to open it first.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-100">
      <EditorProvider
        content={initialContent}
        extensions={extensions}
        editable={false}
        immediatelyRender={false}
        editorProps={{
          attributes: {
            class:
              'prose prose-zinc dark:prose-invert max-w-none focus:outline-none',
          },
        }}
      >
        <EditorContentWrapper />
      </EditorProvider>
    </div>
  )
}

function EditorContentWrapper() {
  const { editor } = useCurrentEditor()

  if (!editor) {
    return null
  }

  return <EditorContent editor={editor} />
}
