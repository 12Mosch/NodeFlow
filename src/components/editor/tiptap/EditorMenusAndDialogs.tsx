import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { GripVertical } from 'lucide-react'
import { IMAGE_MIME_TYPES } from './extensions'
import type { MathEditorState } from './types'
import type { Editor } from '@tiptap/core'
import type {
  ChangeEvent,
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from 'react'
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
import { BrokenLinkDialog } from '@/components/editor/broken-link-dialog'
import { DocumentLinkPopover } from '@/components/editor/document-link-popover'
import { EditorBubbleMenu } from '@/components/editor/bubble-menu'
import { ImageBubbleMenu } from '@/components/editor/image-bubble-menu'
import { MathEditorPopover } from '@/components/editor/math-editor-popover'

interface EditorMenusAndDialogsProps {
  editor: Editor
  variant: 'card' | 'plain'
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  isUploading: boolean
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>
  showLinkWarning: boolean
  setShowLinkWarning: (open: boolean) => void
  pendingLinkUrl: string | null
  onCancelOpenLink: () => void
  onConfirmOpenLink: () => void
  showBrokenLinkDialog: boolean
  setShowBrokenLinkDialog: (open: boolean) => void
  brokenLinkPosition: number | null
  showDocumentLinkPicker: boolean
  setShowDocumentLinkPicker: (open: boolean) => void
  pendingLinkRangeRef: MutableRefObject<{ from: number; to: number } | null>
  linkWasAppliedRef: MutableRefObject<boolean>
  editorRef: MutableRefObject<Editor | null>
  mathEditor: MathEditorState
  setMathEditor: Dispatch<SetStateAction<MathEditorState>>
  children: ReactNode
}

export function EditorMenusAndDialogs({
  editor,
  variant,
  fileInputRef,
  isUploading,
  onFileInputChange,
  showLinkWarning,
  setShowLinkWarning,
  pendingLinkUrl,
  onCancelOpenLink,
  onConfirmOpenLink,
  showBrokenLinkDialog,
  setShowBrokenLinkDialog,
  brokenLinkPosition,
  showDocumentLinkPicker,
  setShowDocumentLinkPicker,
  pendingLinkRangeRef,
  linkWasAppliedRef,
  editorRef,
  mathEditor,
  setMathEditor,
  children,
}: EditorMenusAndDialogsProps) {
  const acceptedImageMimeTypes = IMAGE_MIME_TYPES.join(',')

  return (
    <div
      className={
        variant === 'card'
          ? 'flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-xs'
          : 'flex flex-1 flex-col overflow-hidden'
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedImageMimeTypes}
        className="hidden"
        onChange={(event) => {
          void onFileInputChange(event)
        }}
        disabled={isUploading}
      />
      <DragHandle editor={editor} className="drag-handle">
        <GripVertical className="h-4 w-4" />
      </DragHandle>
      <EditorBubbleMenu />
      <ImageBubbleMenu />

      {children}

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
            <AlertDialogCancel onClick={onCancelOpenLink}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmOpenLink}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BrokenLinkDialog
        open={showBrokenLinkDialog}
        onOpenChange={setShowBrokenLinkDialog}
        editor={editor}
        linkPosition={brokenLinkPosition}
      />

      <AlertDialog
        open={showDocumentLinkPicker}
        onOpenChange={(open) => {
          if (!open) {
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
