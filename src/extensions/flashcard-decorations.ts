import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'

export const flashcardDecorationsPluginKey = new PluginKey(
  'flashcardDecorations',
)

// Syntax patterns for flashcard detection
// Order matters: more specific patterns must come first
interface SyntaxPattern {
  pattern: RegExp
  type: 'basic' | 'concept' | 'descriptor' | 'cloze'
  disabled: boolean
}

const SYNTAX_PATTERNS: Array<SyntaxPattern> = [
  // Disabled patterns (must come before non-disabled)
  { pattern: />>-/g, type: 'basic', disabled: true },
  { pattern: /<<-/g, type: 'basic', disabled: true },
  { pattern: /<>-/g, type: 'basic', disabled: true },
  { pattern: /==-/g, type: 'basic', disabled: true },
  { pattern: /::-/g, type: 'concept', disabled: true },
  { pattern: /:>-/g, type: 'concept', disabled: true },
  { pattern: /:<-/g, type: 'concept', disabled: true },
  { pattern: /;;<>-/g, type: 'descriptor', disabled: true },
  { pattern: /;;<-/g, type: 'descriptor', disabled: true },
  { pattern: /;;-/g, type: 'descriptor', disabled: true },

  // Multi-line patterns (triple markers)
  { pattern: />>>/g, type: 'basic', disabled: false },
  { pattern: /<<</g, type: 'basic', disabled: false },
  { pattern: /<><>/g, type: 'basic', disabled: false },
  { pattern: /===/g, type: 'basic', disabled: false },
  { pattern: /:::/g, type: 'concept', disabled: false },
  { pattern: /:>>/g, type: 'concept', disabled: false },
  { pattern: /:<</g, type: 'concept', disabled: false },
  { pattern: /;;;/g, type: 'descriptor', disabled: false },
  { pattern: /;;<>/g, type: 'descriptor', disabled: false },
  { pattern: /;<</g, type: 'descriptor', disabled: false },

  // Bidirectional patterns (must come before single-direction)
  { pattern: /;<>/g, type: 'descriptor', disabled: false },
  { pattern: /<>/g, type: 'basic', disabled: false },

  // Standard patterns
  { pattern: />>/g, type: 'basic', disabled: false },
  { pattern: /<</g, type: 'basic', disabled: false },
  { pattern: /==/g, type: 'basic', disabled: false },
  { pattern: /::/g, type: 'concept', disabled: false },
  { pattern: /:>/g, type: 'concept', disabled: false },
  { pattern: /:</g, type: 'concept', disabled: false },
  { pattern: /;;/g, type: 'descriptor', disabled: false },
  { pattern: /;</g, type: 'descriptor', disabled: false },

  // Cloze pattern (non-greedy to handle } inside content)
  { pattern: /\{\{(.*?)\}\}/g, type: 'cloze', disabled: false },
]

// Icon SVGs from lucide-react (defined once at module level)
const FLASHCARD_ICONS = {
  basic: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>`,
  concept: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  descriptor: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  cloze: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/></svg>`,
} as const

// Create icon HTML for a given card type
function createIconHTML(
  type: 'basic' | 'concept' | 'descriptor' | 'cloze',
  disabled: boolean,
): string {
  const iconClass = disabled
    ? 'flashcard-icon flashcard-icon-disabled'
    : `flashcard-icon flashcard-icon-${type}`

  return `<span class="${iconClass}" contenteditable="false">${FLASHCARD_ICONS[type]}</span>`
}

// Find flashcard syntax positions in text
interface SyntaxMatch {
  from: number
  to: number
  type: 'basic' | 'concept' | 'descriptor' | 'cloze'
  disabled: boolean
  text: string
}

function findFlashcardSyntax(text: string): Array<SyntaxMatch> {
  const matches: Array<SyntaxMatch> = []

  for (const { pattern, type, disabled } of SYNTAX_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        from: match.index,
        to: match.index + match[0].length,
        type,
        disabled,
        text: match[0],
      })
    }
  }

  // Sort by position, then by length (longer matches first)
  matches.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    return b.text.length - a.text.length // Longer matches first
  })

  // Remove overlapping matches in a single pass (O(N))
  // Since matches are sorted by start position (and longer matches come first
  // at the same position), we can simply track the last accepted match's end
  const filteredMatches: Array<SyntaxMatch> = []
  let lastEnd = -1

  for (const match of matches) {
    // If this match starts at or after the last match ended, it doesn't overlap
    if (match.from >= lastEnd) {
      filteredMatches.push(match)
      lastEnd = match.to
    }
  }

  return filteredMatches
}

// Check if cursor is inside the given node
function isCursorInNode(
  state: EditorState,
  nodePos: number,
  node: ProseMirrorNode,
): boolean {
  const { from, to } = state.selection
  // Node content starts at nodePos + 1, ends at nodePos + 1 + node.content.size
  const nodeStart = nodePos
  const nodeEnd = nodePos + node.nodeSize
  // Check if selection is within the node's range
  return (
    (from >= nodeStart && from <= nodeEnd) || (to >= nodeStart && to <= nodeEnd)
  )
}

// Get the position of the text block containing the cursor
function getCursorNodePos(state: EditorState): number | null {
  let nodePos: number | null = null

  state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (nodePos !== null) return false // Already found
    if (node.isTextblock && isCursorInNode(state, pos, node)) {
      nodePos = pos
      return false // Stop searching
    }
  })

  return nodePos
}

// Build decorations for a document
function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Array<Decoration> = []

  state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    // Only process text-containing blocks
    if (!node.isTextblock) {
      return
    }

    // Check if cursor is in this node
    const cursorInNode = isCursorInNode(state, pos, node)

    // If cursor is in this node, don't add decorations (show raw syntax)
    if (cursorInNode) {
      return
    }

    // Get text content
    const text = node.textContent

    // Find all syntax matches
    const matches = findFlashcardSyntax(text)

    for (const match of matches) {
      // Calculate absolute position in document
      const from = pos + 1 + match.from
      const to = pos + 1 + match.to

      // Special handling for cloze cards - show the content, hide only delimiters
      if (match.type === 'cloze') {
        // Icon before opening {{
        const iconBefore = createIconHTML(match.type, match.disabled)
        const widgetBefore = document.createElement('span')
        widgetBefore.innerHTML = iconBefore
        widgetBefore.contentEditable = 'false'

        decorations.push(
          Decoration.widget(from, widgetBefore, {
            side: -1,
            key: `flashcard-icon-before-${from}`,
          }),
        )

        // Hide opening {{
        decorations.push(
          Decoration.inline(from, from + 2, {
            class: 'flashcard-syntax-hidden',
          }),
        )

        // Hide closing }}
        decorations.push(
          Decoration.inline(to - 2, to, {
            class: 'flashcard-syntax-hidden',
          }),
        )

        // Highlight the cloze content
        decorations.push(
          Decoration.inline(from + 2, to - 2, {
            class: 'flashcard-cloze-content',
          }),
        )

        // Icon after closing }}
        const iconAfter = createIconHTML(match.type, match.disabled)
        const widgetAfter = document.createElement('span')
        widgetAfter.innerHTML = iconAfter
        widgetAfter.contentEditable = 'false'

        decorations.push(
          Decoration.widget(to, widgetAfter, {
            side: 1,
            key: `flashcard-icon-after-${from}`,
          }),
        )
      } else {
        // For other card types, show icon and hide entire syntax
        const icon = createIconHTML(match.type, match.disabled)
        const widget = document.createElement('span')
        widget.innerHTML = icon
        widget.contentEditable = 'false'

        decorations.push(
          Decoration.widget(from, widget, {
            side: -1,
            key: `flashcard-icon-${from}`,
          }),
        )

        // Create inline decoration to hide the syntax
        decorations.push(
          Decoration.inline(from, to, {
            class: 'flashcard-syntax-hidden',
          }),
        )
      }
    }
  })

  return DecorationSet.create(state.doc, decorations)
}

export const FlashcardDecorations = Extension.create({
  name: 'flashcardDecorations',

  addProseMirrorPlugins() {
    // Track the cursor node position to avoid unnecessary rebuilds
    let lastCursorNodePos: number | null = null

    return [
      new Plugin({
        key: flashcardDecorationsPluginKey,
        state: {
          init(_, state) {
            lastCursorNodePos = getCursorNodePos(state)
            return buildDecorations(state)
          },
          apply(tr, oldDecorationSet, _oldState, newState) {
            // Always rebuild on document changes
            if (tr.docChanged) {
              lastCursorNodePos = getCursorNodePos(newState)
              return buildDecorations(newState)
            }

            // For selection changes, only rebuild if cursor moved to a different node
            if (tr.selectionSet) {
              const currentCursorNodePos = getCursorNodePos(newState)

              // Rebuild if cursor moved between different nodes
              if (currentCursorNodePos !== lastCursorNodePos) {
                lastCursorNodePos = currentCursorNodePos
                return buildDecorations(newState)
              }

              // Cursor is in the same node, no rebuild needed
              return oldDecorationSet
            }

            // Otherwise, map old decorations to new positions
            return oldDecorationSet.map(tr.mapping, tr.doc)
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
