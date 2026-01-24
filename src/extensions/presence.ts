import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { PresenceUser } from '@/hooks/use-presence'

export const presencePluginKey = new PluginKey('presence')

export interface PresenceExtensionOptions {
  /**
   * Callback when local selection changes.
   * Called with cursor position and selection range.
   */
  onSelectionChange?: (
    position: number,
    selectionFrom: number,
    selectionTo: number,
  ) => void
}

/**
 * Create a cursor decoration element for a collaborator.
 */
function createCursorElement(user: PresenceUser): HTMLElement {
  const cursor = document.createElement('span')
  cursor.className = 'presence-cursor'
  cursor.style.setProperty('--presence-color', user.color)
  cursor.setAttribute('data-session-id', user.sessionId)

  // Create name label
  const label = document.createElement('span')
  label.className = 'presence-cursor-label'
  label.textContent = user.name || 'Anonymous'
  label.style.backgroundColor = user.color
  label.spellcheck = false
  cursor.appendChild(label)

  return cursor
}

/**
 * Check if a selection range exactly spans a single node (like a NodeSelection).
 * Returns the node if it does, null otherwise.
 */
function getSelectedNode(
  state: EditorState,
  from: number,
  to: number,
): { node: ReturnType<typeof state.doc.nodeAt>; pos: number } | null {
  const node = state.doc.nodeAt(from)
  if (node && from + node.nodeSize === to) {
    return { node, pos: from }
  }
  return null
}

/**
 * Build decorations for all remote cursors and selections.
 */
function buildDecorations(
  state: EditorState,
  collaborators: Array<PresenceUser>,
): DecorationSet {
  const decorations: Array<Decoration> = []
  const docSize = state.doc.content.size

  for (const user of collaborators) {
    let hasNodeSelection = false

    // Add selection highlight if there's a selection range
    if (
      user.selectionFrom !== undefined &&
      user.selectionTo !== undefined &&
      user.selectionFrom !== user.selectionTo
    ) {
      // Clamp selection to valid document range
      const from = Math.max(0, Math.min(user.selectionFrom, docSize))
      const to = Math.max(0, Math.min(user.selectionTo, docSize))

      if (from < to) {
        // Check if this is a node selection (e.g., math block, image)
        // Node selections need Decoration.node to highlight node views properly
        const selectedNode = getSelectedNode(state, from, to)

        if (selectedNode && selectedNode.node?.isAtom) {
          hasNodeSelection = true
          // Use node decoration for atom nodes (math, images, etc.)
          // This properly highlights custom node views
          // The data-presence-name attribute is used by CSS ::after pseudo-element to show the name
          decorations.push(
            Decoration.node(from, to, {
              class: 'presence-selection-node',
              style: `--presence-color: ${user.color};`,
              'data-presence-name': user.name || 'Anonymous',
            }),
          )
        } else {
          // Use inline decoration for regular text selections
          decorations.push(
            Decoration.inline(from, to, {
              class: 'presence-selection',
              style: `background-color: ${user.color}33;`, // 20% opacity
            }),
          )
        }
      }
    }

    // Add cursor at the current position
    // Skip cursor for node selections since the outline already indicates presence
    if (user.cursorPosition !== undefined && !hasNodeSelection) {
      // Clamp position to valid document range
      const pos = Math.max(0, Math.min(user.cursorPosition, docSize))

      const cursorElement = createCursorElement(user)
      decorations.push(
        Decoration.widget(pos, cursorElement, {
          side: -1, // Place before text at this position (like a caret)
          key: `cursor-${user.sessionId}`,
        }),
      )
    }
  }

  return DecorationSet.create(state.doc, decorations)
}

// Module-level storage for collaborators
// This allows updating collaborators without recreating the extension
let currentCollaborators: Array<PresenceUser> = []
let collaboratorsVersion = 0

/**
 * Update the collaborators list for presence rendering.
 * Call this whenever the collaborators change to update cursor positions.
 */
export function setPresenceCollaborators(
  collaborators: Array<PresenceUser>,
): void {
  currentCollaborators = collaborators
  collaboratorsVersion++
}

/**
 * Tiptap extension for real-time presence indicators.
 * Tracks local selection changes and renders remote cursors.
 *
 * Usage:
 * 1. Add PresenceExtension to your editor extensions
 * 2. Use setPresenceCollaborators() to update the collaborators list
 * 3. Decorations will be rebuilt on each render
 */
export const PresenceExtension = Extension.create<PresenceExtensionOptions>({
  name: 'presence',

  addOptions() {
    return {
      onSelectionChange: undefined,
    }
  },

  addProseMirrorPlugins() {
    const { onSelectionChange } = this.options

    return [
      new Plugin({
        key: presencePluginKey,

        state: {
          init(_, state) {
            return {
              decorations: buildDecorations(state, currentCollaborators),
              version: collaboratorsVersion,
            }
          },

          apply(tr, oldState, _oldEditorState, newState) {
            // Report selection changes to callback
            if (tr.selectionSet && onSelectionChange) {
              const { from, to } = newState.selection
              // Use head (cursor position) as the primary position
              const head = newState.selection.$head.pos
              onSelectionChange(head, from, to)
            }

            // Rebuild decorations if collaborators changed or document changed
            if (collaboratorsVersion !== oldState.version || tr.docChanged) {
              return {
                decorations: buildDecorations(newState, currentCollaborators),
                version: collaboratorsVersion,
              }
            }

            // Map existing decorations to new positions
            return {
              decorations: oldState.decorations.map(tr.mapping, tr.doc),
              version: oldState.version,
            }
          },
        },

        props: {
          decorations(state) {
            const pluginState = presencePluginKey.getState(state)
            return pluginState?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
