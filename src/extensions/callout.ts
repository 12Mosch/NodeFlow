import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { CommandProps } from '@tiptap/core'
import { CalloutView } from '@/components/editor/callout-view'

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    callout: {
      /**
       * Set a callout block
       */
      setCallout: (attributes?: { emoji?: string }) => ReturnType
      /**
       * Toggle a callout block
       */
      toggleCallout: (attributes?: { emoji?: string }) => ReturnType
    }
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: 'callout',
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },

  addCommands() {
    return {
      setCallout:
        (attributes?: { emoji?: string }) =>
        ({ commands }: CommandProps) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes?: { emoji?: string }) =>
        ({ commands }: CommandProps) => {
          return commands.toggleWrap(this.name, attributes)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    }
  },
})
