'use client'

import { EditorProvider } from '@tiptap/react'
import type { TiptapEditorProps } from '@/components/editor/tiptap/types'
import { DocumentPreview } from '@/components/document-preview'
import { EditorContentWrapper } from '@/components/editor/tiptap/EditorContentWrapper'
import { useTiptapEditorSetup } from '@/components/editor/tiptap/useTiptapEditorSetup'

export function TiptapEditor({
  documentId,
  onEditorReady,
  previewBlocks,
  collaborators = [],
  onCursorChange,
  searchQuery,
  variant = 'card',
}: TiptapEditorProps) {
  const hasCardChrome = variant === 'card'
  const { isLoading, initialContent, extensions } = useTiptapEditorSetup({
    documentId,
    collaborators,
    searchQuery,
    onCursorChange,
  })

  if (isLoading || initialContent === null) {
    if (previewBlocks && previewBlocks.length > 0) {
      return (
        <div
          className={
            hasCardChrome
              ? 'flex w-full flex-1 flex-col rounded-2xl border border-border/70 bg-card/50 shadow-xs'
              : 'flex w-full flex-1 flex-col'
          }
        >
          <DocumentPreview blocks={previewBlocks} />
        </div>
      )
    }

    return (
      <div
        className={
          hasCardChrome
            ? 'flex h-64 items-center justify-center rounded-2xl border border-border/70 bg-card/50 shadow-xs'
            : 'flex h-64 items-center justify-center'
        }
      >
        <div className="animate-pulse text-muted-foreground">
          {isLoading ? 'Loading document...' : 'Initializing document...'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <EditorProvider
        content={initialContent}
        extensions={extensions}
        immediatelyRender={false}
      >
        <EditorContentWrapper
          documentId={documentId}
          onEditorReady={onEditorReady}
          variant={variant}
        />
      </EditorProvider>
    </div>
  )
}
