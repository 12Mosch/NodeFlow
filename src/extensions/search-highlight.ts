import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Fuse from 'fuse.js'
import {
  SEARCH_HIGHLIGHT_CLASS,
  escapeRegExp,
  findAllFuzzyMatches,
} from '../lib/utils'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import type { IFuseOptions } from 'fuse.js'

export const searchHighlightPluginKey = new PluginKey('searchHighlight')

// Module-level state for search query
let currentSearchQuery = ''

// Store editor instance to dispatch transactions
let editorInstance: Editor | null = null

// Fuse.js configuration for fuzzy matching
const FUSE_OPTIONS: IFuseOptions<{ text: string; pos: number }> = {
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: ['text'],
}

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
 * Build decorations using Fuse.js for fuzzy matching.
 * Collects all text fragments, creates a Fuse index, and highlights fuzzy matches.
 */
function buildFuzzyDecorations(
  state: EditorState,
  query: string,
): Array<Decoration> {
  const decorations: Array<Decoration> = []
  const textFragments: Array<{ text: string; pos: number }> = []

  // Collect all text nodes with their positions
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return true
    }

    textFragments.push({ text: node.text, pos })
    return false
  })

  // Skip if no text fragments to search
  if (textFragments.length === 0) {
    return decorations
  }

  try {
    // Create Fuse index from text fragments
    const fuse = new Fuse(textFragments, FUSE_OPTIONS)

    // Search for fuzzy matches
    const matches = fuse.search(query)

    // For each matched fragment, find and highlight fuzzy matches
    for (const match of matches) {
      const { text, pos } = match.item

      // Try to use Fuse's matched indices if available
      const matchedIndices = match.matches?.[0]?.indices

      if (matchedIndices && matchedIndices.length > 0) {
        // Use Fuse's matched indices to highlight the specific matching part
        for (const [start, end] of matchedIndices) {
          const from = pos + start
          const to = pos + end + 1

          decorations.push(
            Decoration.inline(from, to, {
              class: `search-highlight ${SEARCH_HIGHLIGHT_CLASS}`,
            }),
          )
        }
      } else {
        // Use our fuzzy matching algorithm to find the best matching substring(s)
        const fuzzyMatches = findAllFuzzyMatches(text, query, 0.5)

        for (const { start, end } of fuzzyMatches) {
          const from = pos + start
          const to = pos + end

          decorations.push(
            Decoration.inline(from, to, {
              class: `search-highlight ${SEARCH_HIGHLIGHT_CLASS}`,
            }),
          )
        }
      }
    }
  } catch (error) {
    // If Fuse fails, fall back to exact matching
    console.warn('Fuzzy search failed, falling back to exact match:', error)
    return []
  }

  return decorations
}

/**
 * Build decorations using exact regex matching.
 * Used as fallback when Fuse.js returns no results or fails.
 */
function buildExactDecorations(
  state: EditorState,
  query: string,
): Array<Decoration> {
  const decorations: Array<Decoration> = []

  // Create case-insensitive regex for matching
  const escapedQuery = escapeRegExp(query)
  const regex = new RegExp(`(${escapedQuery})`, 'gi')

  // Traverse all text nodes in the document
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
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

  return decorations
}

/**
 * Build decorations for search highlights.
 */
function buildDecorations(state: EditorState): DecorationSet {
  // Skip if query is empty or whitespace-only
  if (!currentSearchQuery || !currentSearchQuery.trim()) {
    return DecorationSet.empty
  }

  // Skip if query is too short for fuzzy matching
  if (currentSearchQuery.trim().length < FUSE_OPTIONS.minMatchCharLength!) {
    return DecorationSet.empty
  }

  let decorations: Array<Decoration>

  // Try fuzzy matching first
  const fuzzyDecorations = buildFuzzyDecorations(state, currentSearchQuery)

  // Fall back to exact matching if Fuse returns no results
  if (fuzzyDecorations.length === 0) {
    decorations = buildExactDecorations(state, currentSearchQuery)
  } else {
    decorations = fuzzyDecorations
  }

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
