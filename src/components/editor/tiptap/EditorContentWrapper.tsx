import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useCurrentEditor } from '@tiptap/react'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { NodeSelection } from '@tiptap/pm/state'
import { toast } from 'sonner'
import { api } from '../../../../convex/_generated/api'
import { EditorMenusAndDialogs } from './EditorMenusAndDialogs'
import type { Editor } from '@tiptap/core'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { MathEditorState } from './types'
import { useImageUpload } from '@/hooks/use-image-upload'
import {
  DOCUMENT_LINK_EVENT,
  IMAGE_DROP_PASTE_EVENT,
  IMAGE_UPLOAD_EVENT,
  MATH_EDIT_EVENT,
} from '@/extensions/slash-commands'

interface EditorContentWrapperProps {
  documentId: Id<'documents'>
  onEditorReady?: (editor: Editor) => void
  variant: 'card' | 'plain'
}

export function EditorContentWrapper({
  documentId,
  onEditorReady,
  variant,
}: EditorContentWrapperProps) {
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
  const pendingLinkRangeRef = useRef<{
    from: number
    to: number
  } | null>(null)
  const linkWasAppliedRef = useRef(false)
  const isMountedRef = useRef(true)
  const editorRef = useRef<Editor | null>(null)
  const notifiedEditorRef = useRef<Editor | null>(null)
  const notifiedCallbackRef = useRef<((editor: Editor) => void) | undefined>(
    undefined,
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

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
      const currentEditor = editorRef.current
      if (isMountedRef.current && currentEditor && !currentEditor.isDestroyed) {
        try {
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

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        await uploadImage(file)
      } catch (error) {
        console.error('Failed to upload image:', error)
      }
    }
    e.target.value = ''
  }

  useEffect(() => {
    const handleImageUploadEvent = () => {
      fileInputRef.current?.click()
    }
    window.addEventListener(IMAGE_UPLOAD_EVENT, handleImageUploadEvent)
    return () => {
      window.removeEventListener(IMAGE_UPLOAD_EVENT, handleImageUploadEvent)
    }
  }, [])

  useEffect(() => {
    const handleImageDropPaste = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        files: Array<File>
        pos?: number
      }>
      const { files } = customEvent.detail
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      await Promise.allSettled(
        imageFiles.map((file) =>
          uploadImage(file).catch((error) => {
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
      try {
        const mathElement = currentEditor.view.nodeDOM(
          pos,
        ) as HTMLElement | null
        if (mathElement) {
          const rect = mathElement.getBoundingClientRect()
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

  useEffect(() => {
    const handleDocumentLinkEvent = () => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      const { from, to } = currentEditor.state.selection
      if (from === to) {
        currentEditor
          .chain()
          .focus()
          .insertContent('Link')
          .setTextSelection({ from, to: from + 4 })
          .run()
        pendingLinkRangeRef.current = { from, to: from + 4 }
      } else {
        pendingLinkRangeRef.current = null
      }
      linkWasAppliedRef.current = false
      setShowDocumentLinkPicker(true)
    }
    window.addEventListener(DOCUMENT_LINK_EVENT, handleDocumentLinkEvent)
    return () => {
      window.removeEventListener(DOCUMENT_LINK_EVENT, handleDocumentLinkEvent)
    }
  }, [])

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
        setMathEditor((prev) => ({ ...prev, isOpen: false }))
      }
    }
    window.addEventListener('scroll', updateAnchorPosition, true)
    window.addEventListener('resize', updateAnchorPosition)
    return () => {
      window.removeEventListener('scroll', updateAnchorPosition, true)
      window.removeEventListener('resize', updateAnchorPosition)
    }
  }, [mathEditor.isOpen, mathEditor.position])

  useEffect(() => {
    if (!editor || !onEditorReady) return
    const didNotifyEditor = notifiedEditorRef.current === editor
    const didNotifyCallback = notifiedCallbackRef.current === onEditorReady
    if (didNotifyEditor && didNotifyCallback) return

    notifiedEditorRef.current = editor
    notifiedCallbackRef.current = onEditorReady
    onEditorReady(editor)
  }, [editor, onEditorReady])

  const handleLinkClick = useCallback(
    (e: Event) => {
      if (!editor) return
      const mouseEvent = e as MouseEvent
      if (mouseEvent.button !== 0) return
      const targetNode = mouseEvent.target
      if (!(targetNode instanceof Node)) return
      if (!editor.view.dom.contains(targetNode)) return
      const pos = editor.view.posAtCoords({
        left: mouseEvent.clientX,
        top: mouseEvent.clientY,
      })
      if (!pos) return
      const $pos = editor.state.doc.resolve(pos.pos)
      const linkMark = editor.schema.marks.link
      const linkMarkInstance = $pos.marks().find((m) => m.type === linkMark)
      const href = linkMarkInstance?.attrs.href as string | undefined
      if (!href) return
      const linkDocumentId = linkMarkInstance?.attrs.documentId as
        | string
        | undefined
      mouseEvent.preventDefault()
      mouseEvent.stopImmediatePropagation()
      mouseEvent.stopPropagation()
      if (linkDocumentId) {
        void (async () => {
          try {
            const doc = await queryClient.fetchQuery(
              convexQuery(api.documents.get, {
                id: linkDocumentId as Id<'documents'>,
              }),
            )
            if (doc) {
              navigate({ to: '/doc/$docId', params: { docId: linkDocumentId } })
            } else {
              setBrokenLinkPosition(pos.pos)
              setShowBrokenLinkDialog(true)
            }
          } catch (error) {
            console.error('Failed to check document existence:', error)
            navigate({ to: '/doc/$docId', params: { docId: linkDocumentId } })
          }
        })()
      } else {
        setPendingLinkUrl(href)
        setShowLinkWarning(true)
      }
    },
    [editor, navigate, queryClient],
  )

  useEffect(() => {
    if (!editor) return
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
    <EditorMenusAndDialogs
      editor={editor}
      variant={variant}
      fileInputRef={fileInputRef}
      isUploading={isUploading}
      onFileInputChange={handleFileInputChange}
      showLinkWarning={showLinkWarning}
      setShowLinkWarning={setShowLinkWarning}
      pendingLinkUrl={pendingLinkUrl}
      onCancelOpenLink={handleCancelOpenLink}
      onConfirmOpenLink={handleConfirmOpenLink}
      showBrokenLinkDialog={showBrokenLinkDialog}
      setShowBrokenLinkDialog={setShowBrokenLinkDialog}
      brokenLinkPosition={brokenLinkPosition}
      showDocumentLinkPicker={showDocumentLinkPicker}
      setShowDocumentLinkPicker={setShowDocumentLinkPicker}
      pendingLinkRangeRef={pendingLinkRangeRef}
      linkWasAppliedRef={linkWasAppliedRef}
      editorRef={editorRef}
      mathEditor={mathEditor}
      setMathEditor={setMathEditor}
    >
      <EditorContent
        editor={editor}
        data-ph-mask
        className="ph-mask ph-no-capture prose prose-zinc dark:prose-invert flex max-w-none flex-1 flex-col focus:outline-none [&_.ProseMirror]:mx-auto [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-4xl [&_.ProseMirror]:flex-1 [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-5 [&_.ProseMirror]:outline-none sm:[&_.ProseMirror]:px-6"
      />
    </EditorMenusAndDialogs>
  )
}
