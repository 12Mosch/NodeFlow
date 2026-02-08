import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import type { CardType } from '@/lib/flashcard-parser'
import { FlashcardIconTooltip } from '@/components/editor/flashcard-icon-tooltip'

export const flashcardDecorationsPluginKey = new PluginKey(
  'flashcardDecorations',
)

// Syntax patterns for flashcard detection
// Order matters: more specific patterns must come first
interface SyntaxPattern {
  pattern: RegExp
  type: CardType
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

const INTERACTIVE_EVENT_TYPES = new Set([
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
])

function createIconWidget(
  pos: number,
  type: CardType,
  disabled: boolean,
  key: string,
  side: number,
  editor: Editor,
): Decoration {
  let renderer: ReactRenderer | null = null

  return Decoration.widget(
    pos,
    () => {
      renderer = new ReactRenderer(FlashcardIconTooltip, {
        editor,
        as: 'span',
        props: {
          type,
          disabled,
        },
      })

      return renderer.element
    },
    {
      side,
      key,
      ignoreSelection: true,
      stopEvent: (event: Event) =>
        INTERACTIVE_EVENT_TYPES.has(event.type.toLowerCase()),
      destroy: () => {
        renderer?.destroy()
        renderer = null
      },
    },
  )
}

// Find flashcard syntax positions in text
interface SyntaxMatch {
  from: number
  to: number
  type: CardType
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
function buildDecorations(state: EditorState, editor: Editor): DecorationSet {
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
        decorations.push(
          createIconWidget(
            from,
            match.type,
            match.disabled,
            `flashcard-icon-before-${from}`,
            -1,
            editor,
          ),
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

        decorations.push(
          createIconWidget(
            to,
            match.type,
            match.disabled,
            `flashcard-icon-after-${from}`,
            1,
            editor,
          ),
        )
      } else {
        // For other card types, show icon and hide entire syntax
        decorations.push(
          createIconWidget(
            from,
            match.type,
            match.disabled,
            `flashcard-icon-${from}`,
            -1,
            editor,
          ),
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
    const editor = this.editor

    return [
      new Plugin({
        key: flashcardDecorationsPluginKey,
        state: {
          init(_, state) {
            lastCursorNodePos = getCursorNodePos(state)
            return buildDecorations(state, editor)
          },
          apply(tr, oldDecorationSet, _oldState, newState) {
            // Always rebuild on document changes
            if (tr.docChanged) {
              lastCursorNodePos = getCursorNodePos(newState)
              return buildDecorations(newState, editor)
            }

            // For selection changes, only rebuild if cursor moved to a different node
            if (tr.selectionSet) {
              const currentCursorNodePos = getCursorNodePos(newState)

              // Rebuild if cursor moved between different nodes
              if (currentCursorNodePos !== lastCursorNodePos) {
                lastCursorNodePos = currentCursorNodePos
                return buildDecorations(newState, editor)
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
