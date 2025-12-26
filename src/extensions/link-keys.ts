import { Extension } from '@tiptap/react'

/**
 * LinkKeys Extension
 *
 * Implements keyboard shortcuts for link operations:
 * - Cmd+Shift+K / Ctrl+Shift+K: Remove link from selected text
 */
export const LinkKeys = Extension.create({
  name: 'linkKeys',

  addKeyboardShortcuts() {
    return {
      // Cmd+Shift+K (Mac) or Ctrl+Shift+K (Windows/Linux): Remove link
      'Mod-Shift-k': ({ editor }) => {
        // Only remove link if one is active
        if (editor.isActive('link')) {
          return editor.chain().focus().unsetLink().run()
        }
        return false
      },
    }
  },
})
