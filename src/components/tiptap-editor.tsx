import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, EditorProvider, useCurrentEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import FileHandler from '@tiptap/extension-file-handler'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Mathematics } from '@tiptap/extension-mathematics'
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap'
import { useMutation } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { Id } from '../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import { ExtendedImage } from '@/extensions/image'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BlockSync } from '@/extensions/block-sync'
import { BLOCK_TYPES_WITH_IDS, UniqueID } from '@/extensions/unique-id'
import { OutlinerKeys } from '@/extensions/outliner-keys'
import { LinkKeys } from '@/extensions/link-keys'
import {
  IMAGE_DROP_PASTE_EVENT,
  IMAGE_UPLOAD_EVENT,
  SlashCommands,
  triggerImageDropPaste,
} from '@/extensions/slash-commands'
import { Callout } from '@/extensions/callout'
import { FlashcardDecorations } from '@/extensions/flashcard-decorations'
import { EditorBubbleMenu } from '@/components/editor/bubble-menu'
import { useImageUpload } from '@/hooks/use-image-upload'

interface TiptapEditorProps {
  documentId: Id<'documents'>
  onEditorReady?: (editor: Editor) => void
}

const EMPTY_DOC = { type: 'doc', content: [] }

export function TiptapEditor({ documentId, onEditorReady }: TiptapEditorProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId)
  const { isLoading, initialContent, create, extension } = sync

  // Store editor instance for math onClick handlers
  const editorRef = useRef<Editor | null>(null)

  // Mutations for block-level sync
  const upsertBlock = useMutation(api.blocks.upsertBlock)
  const deleteBlocks = useMutation(api.blocks.deleteBlocks)
  const syncBlocks = useMutation(api.blocks.syncBlocks)

  // Wrap onEditorReady to also set our ref
  const handleEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      onEditorReady?.(editor)
    },
    [onEditorReady],
  )

  // Math onClick handlers factory - creates handlers that capture editor ref safely
  // These are only called during user interaction (onClick), never during render
  const createMathHandlers = useCallback(
    () => ({
      handleInlineMathClick: (node: ProseMirrorNode, pos: number) => {
        const editor = editorRef.current
        if (!editor) return

        const currentLatex = node.attrs.latex || ''
        const newLatex = window.prompt('Edit LaTeX:', currentLatex)

        if (newLatex !== null) {
          editor.commands.updateInlineMath({ latex: newLatex, pos })
        }
      },
      handleBlockMathClick: (node: ProseMirrorNode, pos: number) => {
        const editor = editorRef.current
        if (!editor) return

        const currentLatex = node.attrs.latex || ''
        const newLatex = window.prompt('Edit LaTeX:', currentLatex)

        if (newLatex !== null) {
          editor.commands.updateBlockMath({ latex: newLatex, pos })
        }
      },
    }),
    [],
  )

  // Callbacks for block sync extension
  const handleBlockUpdate = useCallback(
    (docId: Id<'documents'>, block: BlockData) => {
      void Sentry.startSpan(
        { name: 'BlockSync.upsertBlock', op: 'convex.mutation' },
        async () => {
          await upsertBlock({
            documentId: docId,
            nodeId: block.nodeId,
            type: block.type,
            content: block.content,
            textContent: block.textContent,
            position: block.position,
            attrs: block.attrs,
            // Flashcard fields
            isCard: block.isCard,
            cardType: block.cardType,
            cardDirection: block.cardDirection,
            cardFront: block.cardFront,
            cardBack: block.cardBack,
            clozeOcclusions: block.clozeOcclusions,
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to upsert block:', error)
      })
    },
    // Convex's useMutation returns a function; this rule is aimed at TanStack Query results.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [upsertBlock],
  )

  const handleBlocksDelete = useCallback(
    (docId: Id<'documents'>, nodeIds: Array<string>) => {
      void Sentry.startSpan(
        { name: 'BlockSync.deleteBlocks', op: 'convex.mutation' },
        async () => {
          await deleteBlocks({
            documentId: docId,
            nodeIds,
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to delete blocks:', error)
      })
    },
    // Convex's useMutation returns a function; this rule is aimed at TanStack Query results.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [deleteBlocks],
  )

  const handleInitialSync = useCallback(
    (docId: Id<'documents'>, blocks: Array<BlockData>) => {
      void Sentry.startSpan(
        { name: 'BlockSync.syncBlocks', op: 'convex.mutation' },
        async () => {
          await syncBlocks({
            documentId: docId,
            blocks: blocks.map((b) => ({
              nodeId: b.nodeId,
              type: b.type,
              content: b.content,
              textContent: b.textContent,
              position: b.position,
              attrs: b.attrs,
              // Flashcard fields
              isCard: b.isCard,
              cardType: b.cardType,
              cardDirection: b.cardDirection,
              cardFront: b.cardFront,
              cardBack: b.cardBack,
              clozeOcclusions: b.clozeOcclusions,
            })),
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to sync blocks:', error)
      })
    },
    // Convex's useMutation returns a function; this rule is aimed at TanStack Query results.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [syncBlocks],
  )

  // Auto-create the document in prosemirror-sync if it doesn't exist yet
  useEffect(() => {
    if (!isLoading && initialContent === null) {
      create(EMPTY_DOC)
    }
  }, [isLoading, initialContent, create])

  // Memoize extensions array (must be before early returns to satisfy hooks rules)
  const extensions = useMemo(() => {
    const mathHandlers = createMathHandlers()
    return [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
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
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      // Image extension for uploaded images
      ExtendedImage.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
        allowBase64: false,
      }),
      // File handler for drag/drop and paste of images
      FileHandler.configure({
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'image/bmp',
          'image/tiff',
          'image/heic',
          'image/heif',
        ],
        onDrop: (_editor, files, pos) => {
          // Trigger upload via custom event (handled by EditorContentWrapper)
          triggerImageDropPaste(files, pos)
        },
        onPaste: (_editor, files) => {
          // Trigger upload via custom event (handled by EditorContentWrapper)
          triggerImageDropPaste(files)
        },
      }),
      Superscript,
      Subscript,
      // Mathematics extension for LaTeX formulas
      // ESLint warning is a false positive: mathHandlers callbacks only access editorRef
      // when invoked by user interaction (onClick), never during render phase
      // eslint-disable-next-line react-hooks/refs
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
        inlineOptions: {
          onClick: mathHandlers.handleInlineMathClick,
        },
        blockOptions: {
          onClick: mathHandlers.handleBlockMathClick,
        },
      }),
      // Callout block extension
      Callout,
      // Outliner keyboard shortcuts (Enter, Shift+Enter, Tab, Shift+Tab)
      OutlinerKeys,
      // Link keyboard shortcuts (Cmd+Shift+K / Ctrl+Shift+K to remove link)
      LinkKeys,
      // Slash commands menu for quick block insertion
      SlashCommands,
      // UniqueID extension to assign block IDs to block-level nodes
      UniqueID.configure({
        attributeName: 'blockId',
        types: BLOCK_TYPES_WITH_IDS,
      }),
      // BlockSync extension to track and persist block changes
      BlockSync.configure({
        documentId,
        attributeName: 'blockId',
        debounceMs: 300,
        onBlockUpdate: handleBlockUpdate,
        onBlocksDelete: handleBlocksDelete,
        onInitialSync: handleInitialSync,
      }),
      // Flashcard decorations for visual indicators
      FlashcardDecorations,
      extension,
    ].filter((ext): ext is NonNullable<typeof ext> => ext !== null)
  }, [
    documentId,
    handleBlockUpdate,
    handleBlocksDelete,
    handleInitialSync,
    createMathHandlers,
    extension,
  ])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading document...
        </div>
      </div>
    )
  }

  // Still waiting for document to be created
  if (initialContent === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Initializing document...
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <EditorProvider
        content={initialContent}
        extensions={extensions}
        immediatelyRender={false}
      >
        <EditorContentWrapper
          documentId={documentId}
          onEditorReady={handleEditorReady}
        />
      </EditorProvider>
    </div>
  )
}

function EditorContentWrapper({
  documentId,
  onEditorReady,
}: {
  documentId: Id<'documents'>
  onEditorReady?: (editor: Editor) => void
}) {
  const { editor } = useCurrentEditor()
  const [showLinkWarning, setShowLinkWarning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMountedRef = useRef(true)
  const editorRef = useRef<Editor | null>(null)

  // Track component mount status separately from editor updates
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, []) // Empty deps - only runs on mount/unmount

  // Update editor ref when editor changes
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const { uploadImage } = useImageUpload({
    documentId,
    onUploadStart: () => {
      setIsUploading(true)
      toast.loading('Uploading image...', { id: 'image-upload' })
    },
    onUploadComplete: (url, dimensions) => {
      setIsUploading(false)
      toast.success('Image uploaded!', { id: 'image-upload' })
      // Check if component is still mounted and editor is valid
      const currentEditor = editorRef.current
      if (isMountedRef.current && currentEditor && !currentEditor.isDestroyed) {
        try {
          // Use insertContent to explicitly insert the image as a block-level node
          const result = currentEditor
            .chain()
            .focus()
            .insertContent({
              type: 'image',
              attrs: {
                src: url,
                width: dimensions.width,
                height: dimensions.height,
              },
            })
            .run()

          if (!result) {
            console.error('Failed to insert image: command returned false')
            Sentry.captureMessage('Failed to insert image into editor', {
              level: 'error',
              extra: { url, dimensions },
            })
          }
        } catch (error) {
          console.error('Error inserting image:', error)
          Sentry.captureException(error, {
            extra: { url, dimensions },
          })
          toast.error('Failed to insert image into editor')
        }
      }
    },
    onUploadError: (error) => {
      setIsUploading(false)
      toast.error(error.message || 'Failed to upload image', {
        id: 'image-upload',
      })
    },
  })

  // Handle file input change for slash command image upload
  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        await uploadImage(file)
      } catch (error) {
        // Error is already handled by onUploadError callback in useImageUpload
        // This catch prevents unhandled promise rejection
        console.error('Failed to upload image:', error)
      }
    }
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  // Listen for image upload event from slash commands
  useEffect(() => {
    const handleImageUploadEvent = () => {
      fileInputRef.current?.click()
    }

    window.addEventListener(IMAGE_UPLOAD_EVENT, handleImageUploadEvent)
    return () => {
      window.removeEventListener(IMAGE_UPLOAD_EVENT, handleImageUploadEvent)
    }
  }, [])

  // Listen for image drop/paste events from FileHandler extension
  useEffect(() => {
    const handleImageDropPaste = async (e: Event) => {
      const customEvent = e as CustomEvent<{ files: Array<File>; pos?: number }>
      const { files } = customEvent.detail
      // Note: pos parameter is available but not used. Images are inserted at the
      // current cursor position (via editor.chain().focus()) rather than the original
      // drop position. This is intentional: during async uploads, the user may have
      // moved the cursor, and tracking the original position would add complexity
      // without significant UX benefit.

      // Filter to only image files
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))

      // Upload all dropped/pasted images in parallel for better UX
      // The onUploadComplete callback handles inserting each image into the editor
      // Using Promise.allSettled to continue even if some uploads fail
      await Promise.allSettled(
        imageFiles.map((file) =>
          uploadImage(file).catch((error) => {
            // Error is already handled by onUploadError callback in useImageUpload
            // This catch prevents unhandled promise rejection
            console.error('Failed to upload image:', error)
            return null
          }),
        ),
      )
    }

    window.addEventListener(IMAGE_DROP_PASTE_EVENT, handleImageDropPaste)
    return () => {
      window.removeEventListener(IMAGE_DROP_PASTE_EVENT, handleImageDropPaste)
    }
  }, [uploadImage])

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  const handleLinkClick = useCallback(
    (e: Event) => {
      if (!editor) return

      const mouseEvent = e as MouseEvent
      if (mouseEvent.button !== 0) return

      const targetNode = mouseEvent.target
      if (!(targetNode instanceof Node)) return
      if (!editor.view.dom.contains(targetNode)) return

      // Try to get the position of the click in the editor
      const pos = editor.view.posAtCoords({
        left: mouseEvent.clientX,
        top: mouseEvent.clientY,
      })

      if (!pos) return

      // Check if there's a link mark at this position (works even if the DOM target is a text node)
      const $pos = editor.state.doc.resolve(pos.pos)
      const linkMark = editor.schema.marks.link
      const linkMarkInstance = $pos.marks().find((m) => m.type === linkMark)
      const href = linkMarkInstance?.attrs.href as string | undefined
      if (!href) return

      // Prevent default navigation / other click handlers and show warning
      mouseEvent.preventDefault()
      // Ensure no other handlers get a chance to open the link (e.g. via window.open)
      mouseEvent.stopImmediatePropagation()
      mouseEvent.stopPropagation()
      setPendingLinkUrl(href)
      setShowLinkWarning(true)
    },
    [editor],
  )

  useEffect(() => {
    if (!editor) return

    // Attach at document level (capture phase) so we run before any other handlers that might open the link.
    const doc = editor.view.dom.ownerDocument
    doc.addEventListener('pointerdown', handleLinkClick, true)
    doc.addEventListener('click', handleLinkClick, true)

    return () => {
      doc.removeEventListener('pointerdown', handleLinkClick, true)
      doc.removeEventListener('click', handleLinkClick, true)
    }
  }, [editor, handleLinkClick])

  const handleConfirmOpenLink = useCallback(() => {
    if (pendingLinkUrl) {
      window.open(pendingLinkUrl, '_blank', 'noopener,noreferrer')
    }
    setShowLinkWarning(false)
    setPendingLinkUrl(null)
  }, [pendingLinkUrl])

  const handleCancelOpenLink = useCallback(() => {
    setShowLinkWarning(false)
    setPendingLinkUrl(null)
  }, [])

  if (!editor) {
    return null
  }

  return (
    <>
      {/* Hidden file input for image uploads triggered by slash commands */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={isUploading}
      />
      <DragHandle editor={editor} className="drag-handle">
        <GripVertical className="h-4 w-4" />
      </DragHandle>
      <EditorBubbleMenu />
      <EditorContent
        editor={editor}
        className="prose prose-zinc dark:prose-invert min-h-[400px] max-w-none focus:outline-none [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:outline-none"
      />
      <AlertDialog open={showLinkWarning} onOpenChange={setShowLinkWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this site?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to visit an external website. This link will open in
              a new tab.
              {pendingLinkUrl && (
                <span className="mt-2 block rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                  {pendingLinkUrl}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelOpenLink}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOpenLink}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
