import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { CommandProps } from '@tiptap/core'
import type { Id } from '../../convex/_generated/dataModel'
import { DatabaseView } from '@/components/editor/database/database-view'

export interface DatabaseOptions {
  HTMLAttributes: Record<string, unknown>
  documentId: Id<'documents'> | null
}

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    database: {
      /**
       * Insert a database block
       */
      insertDatabase: (attributes?: { title?: string }) => ReturnType
    }
  }
}

export const Database = Node.create<DatabaseOptions>({
  name: 'database',

  addOptions() {
    return {
      HTMLAttributes: {},
      documentId: null as Id<'documents'> | null,
    }
  },

  group: 'block',

  // Database is an atomic node - content is managed via Convex, not ProseMirror
  atom: true,

  // Makes this node selectable as a whole
  selectable: true,

  // Allows dragging
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: 'Untitled Database',
        parseHTML: (element) =>
          element.getAttribute('data-title') || 'Untitled Database',
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="database"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'database',
        class: 'database-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseView)
  },

  addCommands() {
    return {
      insertDatabase:
        (attributes?: { title?: string }) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: 'database',
            attrs: {
              title: attributes?.title ?? 'Untitled Database',
            },
          })
        },
    }
  },
})
