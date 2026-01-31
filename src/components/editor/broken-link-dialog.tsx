import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { FilePlus, FileWarning, Unlink } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Editor } from '@tiptap/react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface BrokenLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editor: Editor | null
  linkPosition: number | null
}

/** Returns the from/to range of a link mark at the given position */
function getLinkRange(
  editor: Editor,
  position: number,
): { from: number; to: number } | null {
  const { state } = editor.view
  const docSize = state.doc.content.size

  // Bounds check: position must be within valid document range
  if (position < 0 || position > docSize) {
    return null
  }

  const $pos = state.doc.resolve(position)
  const linkMark = editor.schema.marks.link

  const marks = $pos.marks()
  const linkMarkInstance = marks.find((m) => m.type === linkMark)

  if (!linkMarkInstance) return null

  let from = position
  let to = position

  // Walk backward to find start
  for (let pos = position; pos >= 0; pos--) {
    const resolved = state.doc.resolve(pos)
    if (!resolved.marks().some((m) => m.eq(linkMarkInstance))) {
      from = pos + 1
      break
    }
    from = pos
  }

  // Walk forward to find end
  for (let pos = position; pos <= docSize; pos++) {
    const resolved = state.doc.resolve(pos)
    if (!resolved.marks().some((m) => m.eq(linkMarkInstance))) {
      to = pos
      break
    }
    to = pos
  }

  return { from, to }
}

export function BrokenLinkDialog({
  open,
  onOpenChange,
  editor,
  linkPosition,
}: BrokenLinkDialogProps) {
  const navigate = useNavigate()
  const createDocumentMutation = useMutation(api.documents.create)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateDocument = useCallback(async () => {
    if (!editor || linkPosition === null) return

    // Verify the link range exists before creating a document
    const range = getLinkRange(editor, linkPosition)
    if (!range) return

    setIsCreating(true)
    try {
      const { from, to } = range

      // Create a new document
      const newDocId = await createDocumentMutation({ title: 'Untitled' })

      // Update the link with new document reference
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setLink({
          href: `/doc/${newDocId}`,
          documentId: newDocId,
        } as { href: string; documentId: string })
        .run()

      onOpenChange(false)

      // Navigate to the new document
      navigate({ to: '/doc/$docId', params: { docId: newDocId } })
    } catch (error) {
      console.error('Failed to create document:', error)
    } finally {
      setIsCreating(false)
    }
  }, [editor, linkPosition, createDocumentMutation, navigate, onOpenChange])

  const handleRemoveLink = useCallback(() => {
    if (!editor || linkPosition === null) return

    const range = getLinkRange(editor, linkPosition)
    if (!range) return

    const { from, to } = range

    // Remove the link mark
    editor.chain().focus().setTextSelection({ from, to }).unsetLink().run()

    onOpenChange(false)
  }, [editor, linkPosition, onOpenChange])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-destructive" />
            Document Not Found
          </AlertDialogTitle>
          <AlertDialogDescription>
            The linked document no longer exists or has been deleted. What would
            you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleRemoveLink}
            className="gap-2"
          >
            <Unlink className="h-4 w-4" />
            Remove Link
          </Button>
          <Button
            onClick={handleCreateDocument}
            disabled={isCreating}
            className="gap-2"
          >
            <FilePlus className="h-4 w-4" />
            {isCreating ? 'Creating...' : 'Create New Document'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
