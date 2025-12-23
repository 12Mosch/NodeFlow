import { Extension } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

/**
 * OutlinerKeys Extension
 *
 * Implements keyboard behaviors:
 * - Enter: creates a new block at the same level (sibling)
 * - Shift+Enter: creates a new line within the current block
 * - Tab: indents/nests blocks
 * - Shift+Tab: outdents/promotes blocks
 */
export const OutlinerKeys = Extension.create({
  name: 'outlinerKeys',

  addKeyboardShortcuts() {
    return {
      // Enter: Create a new block at the same level
      Enter: ({ editor }) => {
        const { state, view } = editor
        const { selection } = state
        const { $from, $to, empty } = selection

        // In a code block, allow default behavior (new line)
        if (editor.isActive('codeBlock')) {
          return false
        }

        // In a list item, use default list behavior for splitting
        if (editor.isActive('listItem') || editor.isActive('taskItem')) {
          // Check if the list item is empty - if so, lift out of the list
          const node = $from.node($from.depth)
          if (node.textContent === '') {
            // Empty list item - lift out of list
            return (
              editor.chain().liftListItem('listItem').run() ||
              editor.chain().liftListItem('taskItem').run()
            )
          }
          // Non-empty list item - split it
          return (
            editor.chain().splitListItem('listItem').run() ||
            editor.chain().splitListItem('taskItem').run()
          )
        }

        // For regular blocks (paragraphs, headings, etc.)
        // If cursor is at the end of the block, create a new paragraph after
        const isAtEnd = $to.parentOffset === $to.parent.content.size

        if (isAtEnd || empty) {
          // Create a new paragraph after the current block
          const { tr } = state
          const endOfBlock = $from.end($from.depth)

          // Find the end of the current top-level block
          let blockEnd = endOfBlock
          let depth = $from.depth
          while (depth > 1) {
            blockEnd = $from.end(depth - 1)
            depth--
          }

          // Insert a new paragraph
          const paragraph = state.schema.nodes.paragraph.create()
          tr.insert(blockEnd + 1, paragraph)

          // Move cursor to the new paragraph
          const newPos = blockEnd + 2
          tr.setSelection(TextSelection.create(tr.doc, newPos))

          view.dispatch(tr)
          return true
        }

        // Cursor is in the middle - split the block
        return editor.chain().splitBlock().run()
      },

      // Shift+Enter: Insert a hard break (new line within the same block)
      'Shift-Enter': ({ editor }) => {
        // In a code block, just insert a newline
        if (editor.isActive('codeBlock')) {
          return editor.chain().newlineInCode().run()
        }

        // For other blocks, insert a hard break
        return editor.chain().setHardBreak().run()
      },

      // Tab: Indent/nest blocks
      Tab: ({ editor }) => {
        // In a code block, insert actual tab
        if (editor.isActive('codeBlock')) {
          return editor.chain().insertContent('\t').run()
        }

        // In a list, sink the list item (indent)
        if (editor.isActive('listItem')) {
          return editor.chain().sinkListItem('listItem').run()
        }

        if (editor.isActive('taskItem')) {
          return editor.chain().sinkListItem('taskItem').run()
        }

        // For paragraphs or headings, wrap in blockquote for visual indentation
        if (editor.isActive('paragraph') || editor.isActive('heading')) {
          return editor.chain().wrapIn('blockquote').run()
        }

        // For blockquotes, wrap in another blockquote to increase indentation
        if (editor.isActive('blockquote')) {
          return editor.chain().wrapIn('blockquote').run()
        }

        return true // Prevent default tab behavior (focus change)
      },

      // Shift+Tab: Outdent/promote blocks
      'Shift-Tab': ({ editor }) => {
        // In a code block, do nothing special
        if (editor.isActive('codeBlock')) {
          return true
        }

        // In a list, lift the list item (outdent)
        if (editor.isActive('listItem')) {
          return editor.chain().liftListItem('listItem').run()
        }

        if (editor.isActive('taskItem')) {
          return editor.chain().liftListItem('taskItem').run()
        }

        // For blockquotes, lift out (remove one level of indentation)
        if (editor.isActive('blockquote')) {
          return editor.chain().lift('blockquote').run()
        }

        return true // Prevent default behavior
      },
    }
  },
})
