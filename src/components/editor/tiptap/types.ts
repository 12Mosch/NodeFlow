import type { Editor } from '@tiptap/core'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import type { PresenceUser } from '@/hooks/use-presence'

export interface TiptapEditorProps {
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

export interface MathEditorState {
  isOpen: boolean
  nodeType: 'inlineMath' | 'blockMath' | null
  position: number | null
  currentLatex: string
  anchorRect: DOMRect | null
}

export const EMPTY_DOC: { type: 'doc'; content: Array<never> } = {
  type: 'doc',
  content: [],
}

Object.freeze(EMPTY_DOC.content)
Object.freeze(EMPTY_DOC)
