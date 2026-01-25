import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * LinkDropHandler Extension
 *
 * Enables creating links by dragging URLs onto text:
 * - If text is selected: applies the URL as a link to the selection
 * - If no selection: inserts the URL as linked text at drop position
 */

/**
 * Validates that a string is a valid HTTP(S) URL.
 */
function isValidHttpUrl(text: string): boolean {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extracts a URL from dataTransfer, trying multiple MIME types.
 * Priority: text/uri-list > text/plain (if valid URL)
 */
function extractUrlFromDataTransfer(dataTransfer: DataTransfer): string | null {
  // text/uri-list is the standard type for dragged URLs from browser address bar
  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    // uri-list can have multiple lines, take the first non-comment line
    const firstUrl = uriList
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))

    if (firstUrl && isValidHttpUrl(firstUrl)) {
      return firstUrl
    }
  }

  // Fallback to text/plain if it's a valid URL
  const plainText = dataTransfer.getData('text/plain').trim()
  if (plainText && isValidHttpUrl(plainText)) {
    return plainText
  }

  return null
}

export const LinkDropHandler = Extension.create({
  name: 'linkDropHandler',

  addProseMirrorPlugins() {
    const { editor } = this

    return [
      new Plugin({
        key: new PluginKey('linkDropHandler'),

        props: {
          handleDrop(view, event, _slice, moved) {
            // Let the editor handle internal moves (dragging content within editor)
            if (moved) {
              return false
            }

            if (!event.dataTransfer) {
              return false
            }

            // If files are present, let FileHandler extension handle it
            if (event.dataTransfer.files.length > 0) {
              return false
            }

            // Try to extract a URL from the drag data
            const url = extractUrlFromDataTransfer(event.dataTransfer)
            if (!url) {
              return false
            }

            // Prevent default browser behavior (opening the URL)
            event.preventDefault()
            event.stopPropagation()

            const { state } = view
            const { from, to, empty } = state.selection
            const hasTextSelection = !empty && from !== to

            if (hasTextSelection) {
              // Apply link to selected text
              editor.chain().focus().setLink({ href: url }).run()
            } else {
              // No selection: insert URL as linked text at drop position
              const dropPos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              })

              const linkContent = {
                type: 'text',
                text: url,
                marks: [{ type: 'link', attrs: { href: url } }],
              }

              if (dropPos) {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(dropPos.pos, linkContent)
                  .run()
              } else {
                // Fallback: insert at current cursor
                editor.chain().focus().insertContent(linkContent).run()
              }
            }

            return true
          },
        },
      }),
    ]
  },
})
