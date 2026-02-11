'use client'
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
import { useNavigate } from '@tanstack/react-router'
import FileHandler from '@tiptap/extension-file-handler'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Mathematics } from '@tiptap/extension-mathematics'
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap'
import { useMutation } from 'convex/react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { NodeSelection } from '@tiptap/pm/state'
import { api } from '../../convex/_generated/api'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import type { PresenceUser } from '@/hooks/use-presence'
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
import { LinkDropHandler } from '@/extensions/link-drop-handler'
import {
  DOCUMENT_LINK_EVENT,
  IMAGE_DROP_PASTE_EVENT,
  IMAGE_UPLOAD_EVENT,
  MATH_EDIT_EVENT,
  SlashCommands,
  triggerImageDropPaste,
  triggerMathEdit,
} from '@/extensions/slash-commands'
import { Callout } from '@/extensions/callout'
import { Database } from '@/extensions/database'
import { FlashcardDecorations } from '@/extensions/flashcard-decorations'
import {
  PresenceExtension,
  setPresenceCollaborators,
} from '@/extensions/presence'
import { SearchHighlight, setSearchQuery } from '@/extensions/search-highlight'
import { EditorBubbleMenu } from '@/components/editor/bubble-menu'
import { ImageBubbleMenu } from '@/components/editor/image-bubble-menu'
import { MathEditorPopover } from '@/components/editor/math-editor-popover'
import { BrokenLinkDialog } from '@/components/editor/broken-link-dialog'
import { DocumentLinkPopover } from '@/components/editor/document-link-popover'
import { useImageUpload } from '@/hooks/use-image-upload'
import { DocumentPreview } from '@/components/document-preview'

interface TiptapEditorProps {
  documentId: Id<'documents'>
  onEditorReady?: (editor: Editor) => void
  /** Cached blocks to show as preview while editor loads */
  previewBlocks?: Array<Doc<'blocks'>>
  /** Collaborators for presence indicators */
  collaborators?: Array<PresenceUser>
  /** Callback when cursor/selection changes */
  onCursorChange?: (
    position: number,
    selectionFrom: number,
    selectionTo: number,
  ) => void
  /** Search query to highlight in the document */
  searchQuery?: string
  /** Visual wrapper style for embedding in parent layouts */
  variant?: 'card' | 'plain'
}
const EMPTY_DOC = { type: 'doc', content: [] }
/**
 * Extended Link extension that adds documentId attribute for internal document links.
 * - External links: { href: "https://example.com", documentId: null }
 * - Document links: { href: "/doc/{docId}", documentId: "{docId}" }
 */
const ExtendedLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      documentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-document-id'),
        renderHTML: (attributes) => {
          if (!attributes.documentId) {
            return {}
          }
          return { 'data-document-id': attributes.documentId }
        },
      },
    }
  },
})
export function TiptapEditor({
  documentId,
  onEditorReady,
  previewBlocks,
  collaborators = [],
  onCursorChange,
  searchQuery,
  variant = 'card',
}: TiptapEditorProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId)
  const { isLoading, initialContent, create, extension } = sync
  const hasCardChrome = variant === 'card'
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
        const currentLatex = node.attrs.latex || ''
        triggerMathEdit({
          nodeType: 'inlineMath',
          pos,
          latex: currentLatex,
        })
      },
      handleBlockMathClick: (node: ProseMirrorNode, pos: number) => {
        const currentLatex = node.attrs.latex || ''
        triggerMathEdit({
          nodeType: 'blockMath',
          pos,
          latex: currentLatex,
        })
      },
    }),
    [],
  )
  // Callbacks for block sync extension
  const handleBlockUpdate = useCallback(
    (docId: Id<'documents'>, block: BlockData) => {
      void (async () => {
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
      })().catch((error) => {
        console.error('Failed to upsert block:', error)
      })
    },
    [upsertBlock],
  )
  const handleBlocksDelete = useCallback(
    (docId: Id<'documents'>, nodeIds: Array<string>) => {
      void (async () => {
        await deleteBlocks({
          documentId: docId,
          nodeIds,
        })
      })().catch((error) => {
        console.error('Failed to delete blocks:', error)
      })
    },
    [deleteBlocks],
  )
  const handleInitialSync = useCallback(
    (docId: Id<'documents'>, blocks: Array<BlockData>) => {
      void (async () => {
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
      })().catch((error) => {
        console.error('Failed to sync blocks:', error)
      })
    },
    [syncBlocks],
  )
  // Auto-create the document in prosemirror-sync if it doesn't exist yet
  useEffect(() => {
    if (!isLoading && initialContent === null) {
      create(EMPTY_DOC)
    }
  }, [isLoading, initialContent, create])
  // Update presence collaborators when they change
  useEffect(() => {
    setPresenceCollaborators(collaborators)
  }, [collaborators])
  // Update search query for highlighting when it changes
  useEffect(() => {
    setSearchQuery(searchQuery ?? '')
  }, [searchQuery])
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
      ExtendedLink.configure({
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
      // Database table block extension
      Database.configure({
        documentId,
      }),
      // Outliner keyboard shortcuts (Enter, Shift+Enter, Tab, Shift+Tab)
      OutlinerKeys,
      // Link keyboard shortcuts (Cmd+Shift+K / Ctrl+Shift+K to remove link)
      LinkKeys,
      // Link drop handler for creating links by dragging URLs onto text
      LinkDropHandler,
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
      // Presence extension for collaborative cursor indicators
      PresenceExtension.configure({
        onSelectionChange: onCursorChange,
      }),
      // Search highlight extension for highlighting search terms
      SearchHighlight,
      extension,
    ].filter((ext): ext is NonNullable<typeof ext> => ext !== null)
  }, [
    documentId,
    handleBlockUpdate,
    handleBlocksDelete,
    handleInitialSync,
    createMathHandlers,
    onCursorChange,
    extension,
  ])
  if (isLoading || initialContent === null) {
    // Show cached preview content if available, otherwise show loading indicator
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
          onEditorReady={handleEditorReady}
          variant={variant}
        />
      </EditorProvider>
    </div>
  )
}
interface MathEditorState {
  isOpen: boolean
  nodeType: 'inlineMath' | 'blockMath' | null
  position: number | null
  currentLatex: string
  anchorRect: DOMRect | null
}
function EditorContentWrapper({
  documentId,
  onEditorReady,
  variant,
}: {
  documentId: Id<'documents'>
  onEditorReady?: (editor: Editor) => void
  variant: 'card' | 'plain'
}) {
  const { editor } = useCurrentEditor()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showLinkWarning, setShowLinkWarning] = useState(false)
  const [showBrokenLinkDialog, setShowBrokenLinkDialog] = useState(false)
  const [brokenLinkPosition, setBrokenLinkPosition] = useState<number | null>(
    null,
  )
  const [isUploading, setIsUploading] = useState(false)
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null)
  const [mathEditor, setMathEditor] = useState<MathEditorState>({
    isOpen: false,
    nodeType: null,
    position: null,
    currentLatex: '',
    anchorRect: null,
  })
  const [showDocumentLinkPicker, setShowDocumentLinkPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track pending "Link" placeholder insertion for cleanup on cancel
  const pendingLinkRangeRef = useRef<{
    from: number
    to: number
  } | null>(null)
  const linkWasAppliedRef = useRef(false)
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
          }
        } catch (error) {
          console.error('Error inserting image:', error)
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
      const customEvent = e as CustomEvent<{
        files: Array<File>
        pos?: number
      }>
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
  // Listen for math edit events
  useEffect(() => {
    const handleMathEdit = (e: Event) => {
      const customEvent = e as CustomEvent<{
        nodeType: 'inlineMath' | 'blockMath'
        pos: number
        latex: string
      }>
      const { nodeType, pos, latex } = customEvent.detail
      const currentEditor = editorRef.current
      if (!currentEditor) return
      // Get DOM rect for positioning using nodeDOM which returns the node view's DOM element
      try {
        const mathElement = currentEditor.view.nodeDOM(
          pos,
        ) as HTMLElement | null
        if (mathElement) {
          const rect = mathElement.getBoundingClientRect()
          // Select the math node so presence indicators show it as selected
          // This helps collaborators see that someone is editing this math block
          const { state } = currentEditor.view
          const node = state.doc.nodeAt(pos)
          if (node) {
            const nodeSelection = NodeSelection.create(state.doc, pos)
            currentEditor.view.dispatch(state.tr.setSelection(nodeSelection))
          }
          setMathEditor({
            isOpen: true,
            nodeType,
            position: pos,
            currentLatex: latex,
            anchorRect: rect,
          })
        }
      } catch (error) {
        console.error('Error opening math editor:', error)
      }
    }
    window.addEventListener(MATH_EDIT_EVENT, handleMathEdit)
    return () => {
      window.removeEventListener(MATH_EDIT_EVENT, handleMathEdit)
    }
  }, [])
  // Listen for document link events from slash commands
  useEffect(() => {
    const handleDocumentLinkEvent = () => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      // If there's no selection, insert placeholder text "Link" and select it
      const { from, to } = currentEditor.state.selection
      if (from === to) {
        // Insert "Link" text
        currentEditor
          .chain()
          .focus()
          .insertContent('Link')
          .setTextSelection({ from, to: from + 4 })
          .run()
        // Track the inserted placeholder range for cleanup on cancel
        pendingLinkRangeRef.current = { from, to: from + 4 }
      } else {
        // Clear any previous pending range when there's already a selection
        pendingLinkRangeRef.current = null
      }
      // Reset the link applied flag before opening the picker
      linkWasAppliedRef.current = false
      // Open the document link picker
      setShowDocumentLinkPicker(true)
    }
    window.addEventListener(DOCUMENT_LINK_EVENT, handleDocumentLinkEvent)
    return () => {
      window.removeEventListener(DOCUMENT_LINK_EVENT, handleDocumentLinkEvent)
    }
  }, [])
  // Update math editor anchor position on scroll/resize to prevent stale positioning
  useEffect(() => {
    if (!mathEditor.isOpen || mathEditor.position === null) return
    const updateAnchorPosition = () => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      try {
        const mathElement = currentEditor.view.nodeDOM(
          mathEditor.position as number,
        ) as HTMLElement | null
        if (mathElement) {
          const rect = mathElement.getBoundingClientRect()
          setMathEditor((prev) => ({ ...prev, anchorRect: rect }))
        }
      } catch {
        // Node may have been removed, close the popover
        setMathEditor((prev) => ({ ...prev, isOpen: false }))
      }
    }
    // Listen for scroll on the editor container and window
    const editorContainer = editorRef.current?.view.dom.closest(
      '.editor-scroll-container',
    )
    window.addEventListener('scroll', updateAnchorPosition, true)
    window.addEventListener('resize', updateAnchorPosition)
    editorContainer?.addEventListener('scroll', updateAnchorPosition)
    return () => {
      window.removeEventListener('scroll', updateAnchorPosition, true)
      window.removeEventListener('resize', updateAnchorPosition)
      editorContainer?.removeEventListener('scroll', updateAnchorPosition)
    }
  }, [mathEditor.isOpen, mathEditor.position])
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
      // Check if this is a document link
      const linkDocumentId = linkMarkInstance?.attrs.documentId as
        | string
        | undefined
      // Prevent default navigation / other click handlers
      mouseEvent.preventDefault()
      mouseEvent.stopImmediatePropagation()
      mouseEvent.stopPropagation()
      if (linkDocumentId) {
        // Document link - check if document exists before navigating
        void (async () => {
          try {
            const doc = await queryClient.fetchQuery(
              convexQuery(api.documents.get, {
                id: linkDocumentId as Id<'documents'>,
              }),
            )
            if (doc) {
              // Document exists - navigate to it
              navigate({ to: '/doc/$docId', params: { docId: linkDocumentId } })
            } else {
              // Document doesn't exist - show broken link dialog
              setBrokenLinkPosition(pos.pos)
              setShowBrokenLinkDialog(true)
            }
          } catch (error) {
            console.error('Failed to check document existence:', error)
            // On error, try to navigate anyway
            navigate({ to: '/doc/$docId', params: { docId: linkDocumentId } })
          }
        })()
      } else {
        // External link - show warning dialog
        setPendingLinkUrl(href)
        setShowLinkWarning(true)
      }
    },
    [editor, navigate, queryClient],
  )
  useEffect(() => {
    if (!editor) return
    // Attach at document level (capture phase) so we run before any other handlers that might open the link.
    const doc = editor.view.dom.ownerDocument
    doc.addEventListener('click', handleLinkClick, true)
    return () => {
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
    <div
      className={
        variant === 'card'
          ? 'flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-xs'
          : 'flex flex-1 flex-col overflow-hidden'
      }
    >
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
      <ImageBubbleMenu />
      <EditorContent
        editor={editor}
        data-ph-mask
        className="ph-mask ph-no-capture prose prose-zinc dark:prose-invert flex max-w-none flex-1 flex-col focus:outline-none [&_.ProseMirror]:mx-auto [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-4xl [&_.ProseMirror]:flex-1 [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-5 [&_.ProseMirror]:outline-none sm:[&_.ProseMirror]:px-6"
      />
      <AlertDialog open={showLinkWarning} onOpenChange={setShowLinkWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this site?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to visit an external website. This link will open in
              a new tab.
              {pendingLinkUrl && (
                <span className="mt-2 block rounded border border-border/70 bg-muted px-2 py-1 font-mono text-xs break-all">
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

      {/* Broken document link dialog */}
      <BrokenLinkDialog
        open={showBrokenLinkDialog}
        onOpenChange={setShowBrokenLinkDialog}
        editor={editor}
        linkPosition={brokenLinkPosition}
      />

      {/* Document link picker dialog (from slash commands) */}
      <AlertDialog
        open={showDocumentLinkPicker}
        onOpenChange={(open) => {
          if (!open) {
            // Clean up placeholder text if picker was canceled (no link applied)
            if (!linkWasAppliedRef.current && pendingLinkRangeRef.current) {
              const currentEditor = editorRef.current
              if (currentEditor && !currentEditor.isDestroyed) {
                const { from, to } = pendingLinkRangeRef.current
                try {
                  const text = currentEditor.state.doc.textBetween(from, to)
                  if (text === 'Link') {
                    currentEditor
                      .chain()
                      .focus()
                      .deleteRange({ from, to })
                      .run()
                  }
                } catch {
                  // Position may be invalid if doc changed, ignore
                }
              }
            }
            // Reset refs
            pendingLinkRangeRef.current = null
            linkWasAppliedRef.current = false
          }
          setShowDocumentLinkPicker(open)
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Link to Document</AlertDialogTitle>
            <AlertDialogDescription>
              Search for a document to link to the selected text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DocumentLinkPopover
            editor={editor}
            onClose={() => setShowDocumentLinkPicker(false)}
            onLinkApplied={() => {
              linkWasAppliedRef.current = true
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Math editor popover */}
      {mathEditor.isOpen &&
        mathEditor.anchorRect &&
        mathEditor.nodeType &&
        mathEditor.position !== null && (
          <MathEditorPopover
            editor={editor}
            isOpen={mathEditor.isOpen}
            onOpenChange={(open) => {
              if (!open) {
                setMathEditor((prev) => ({ ...prev, isOpen: false }))
              }
            }}
            nodeType={mathEditor.nodeType}
            position={mathEditor.position}
            initialLatex={mathEditor.currentLatex}
            anchorRect={mathEditor.anchorRect}
          />
        )}
    </div>
  )
}
