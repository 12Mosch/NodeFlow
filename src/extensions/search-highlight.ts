import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { SEARCH_HIGHLIGHT_CLASS, escapeRegExp } from '../lib/utils'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'

export const searchHighlightPluginKey = new PluginKey('searchHighlight')

// Module-level state for search query
let currentSearchQuery = ''

// Store editor instance to dispatch transactions
let editorInstance: Editor | null = null

/**
 * Register the editor instance for search highlight functionality.
 * This is called by the extension when the editor is created.
 */
function registerEditor(editor: Editor): void {
  editorInstance = editor

  // If a query was already set before the editor was ready, trigger a rebuild now
  if (currentSearchQuery && currentSearchQuery.trim() && !editor.isDestroyed) {
    const tr = editor.state.tr
    tr.setMeta('searchQueryChanged', true)
    editor.view.dispatch(tr)
  }
}

/**
 * Set the search query for highlighting.
 * Call this function to update the search query from outside the extension.
 * Note: This should be called after the editor is initialized.
 * This will automatically trigger a re-render of the decorations.
 */
export function setSearchQuery(query: string): void {
  currentSearchQuery = query

  // Dispatch a transaction to trigger decoration rebuild
  if (editorInstance && !editorInstance.isDestroyed) {
    const { state } = editorInstance
    const tr = state.tr
    tr.setMeta('searchQueryChanged', true)
    editorInstance.view.dispatch(tr)
  }
}

/**
 * Get the current search query.
 */
export function getSearchQuery(): string {
  return currentSearchQuery
}

/**
 * Build decorations for search highlights.
 */
function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Decoration> = []

  // Skip if query is empty or whitespace-only
  if (!currentSearchQuery || !currentSearchQuery.trim()) {
    return DecorationSet.empty
  }

  // Create case-insensitive regex for matching
  const escapedQuery = escapeRegExp(currentSearchQuery)
  const regex = new RegExp(`(${escapedQuery})`, 'gi')

  // Traverse all text nodes in the document
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      // Return true to continue descending into child nodes
      // Text nodes are typically nested inside paragraph, heading, etc.
      return true
    }

    // Find all matches in this text node
    let match: RegExpExecArray | null
    // Reset regex lastIndex for each node
    regex.lastIndex = 0

    while ((match = regex.exec(node.text)) !== null) {
      const from = pos + match.index
      const to = from + match[0].length

      decorations.push(
        Decoration.inline(from, to, {
          class: `search-highlight ${SEARCH_HIGHLIGHT_CLASS}`,
        }),
      )
    }

    return false
  })

  return DecorationSet.create(state.doc, decorations)
}

/**
 * TipTap extension for highlighting search terms in the document.
 * Uses ProseMirror decorations to apply highlighting styles to matching text.
 */
export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  onCreate() {
    // Register the editor instance so setSearchQuery can dispatch transactions
    registerEditor(this.editor)
  },

  onDestroy() {
    // Clean up the editor reference when destroyed
    if (editorInstance === this.editor) {
      editorInstance = null
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchHighlightPluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state)
          },
          apply(tr, decorationSet, _, newState) {
            // Check if search query changed (via meta)
            const queryChanged = tr.getMeta('searchQueryChanged')

            // Rebuild decorations if:
            // 1. Query explicitly changed via meta
            // 2. Document content changed
            if (queryChanged || tr.docChanged) {
              return buildDecorations(newState)
            }

            // Map decorations through the transaction
            return decorationSet.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
