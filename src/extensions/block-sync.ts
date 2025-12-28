import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Id } from '../../convex/_generated/dataModel'
import type { CardDirection, CardType } from '@/lib/flashcard-parser'
import { parseFlashcard } from '@/lib/flashcard-parser'

// Types for block data
export interface BlockData {
  nodeId: string
  type: string
  content: any
  textContent: string
  position: number
  attrs?: any
  // Flashcard fields
  isCard: boolean
  cardType?: CardType
  cardDirection?: CardDirection
  cardFront?: string
  cardBack?: string
  clozeOcclusions?: Array<string>
}

export interface BlockSyncOptions {
  documentId: Id<'documents'>
  attributeName: string
  debounceMs: number
  onBlockUpdate: (documentId: Id<'documents'>, block: BlockData) => void
  onBlocksDelete: (documentId: Id<'documents'>, nodeIds: Array<string>) => void
  onInitialSync: (documentId: Id<'documents'>, blocks: Array<BlockData>) => void
}

export const blockSyncPluginKey = new PluginKey('blockSync')

function serializeNodeTextForFlashcards(node: ProseMirrorNode): string {
  const type = node.type.name

  // Text leaf
  if (type === 'text') {
    return node.textContent
  }

  if (type === 'hardBreak') {
    return '\n'
  }

  const serializeChildren = (separator = ''): string => {
    const parts: Array<string> = []
    node.forEach((child) => {
      const s = serializeNodeTextForFlashcards(child)
      if (s) parts.push(s)
    })
    return parts.join(separator)
  }

  // Lists: inject visible markers so quiz UI can render bullets/numbers.
  if (type === 'bulletList') {
    const items: Array<string> = []
    node.forEach((child) => {
      if (child.type.name !== 'listItem') return
      const itemText = serializeNodeTextForFlashcards(child).trim()
      if (!itemText) return
      items.push(`• ${itemText}`)
    })
    return items.join('\n')
  }

  if (type === 'orderedList') {
    const items: Array<string> = []
    const orderAttr = node.attrs.order
    const start =
      typeof orderAttr === 'number' && Number.isFinite(orderAttr)
        ? orderAttr
        : 1
    let i = 0
    node.forEach((child) => {
      if (child.type.name !== 'listItem') return
      const itemText = serializeNodeTextForFlashcards(child).trim()
      if (!itemText) return
      items.push(`${start + i}. ${itemText}`)
      i++
    })
    return items.join('\n')
  }

  // A listItem typically contains a paragraph (and optionally nested lists).
  // Join children with newlines to keep nested lists readable.
  if (type === 'listItem') {
    return serializeChildren('\n')
  }

  // Block types: join children as a single line of text.
  if (type === 'paragraph' || type === 'heading') {
    return serializeChildren('')
  }

  // Doc/root: separate blocks by newlines.
  if (type === 'doc') {
    return serializeChildren('\n')
  }

  // Fallback: preserve as best-effort plain text with newlines between children.
  return serializeChildren('\n')
}

// Extract block data from a ProseMirror node
function extractBlockData(
  node: ProseMirrorNode,
  doc: ProseMirrorNode,
  offset: number,
  position: number,
  attributeName: string,
): BlockData | null {
  const nodeId = node.attrs[attributeName]
  if (!nodeId) return null

  // Keep a compact textContent for search/indexing, but parse flashcards from a
  // newline-preserving representation so multi-line cards (e.g. list children)
  // can roundtrip as `\n` instead of concatenated words.
  const textContent = node.textContent
  let textForFlashcardParsing = serializeNodeTextForFlashcards(node)

  // If the block itself is a list item, include the bullet/number marker on the
  // first line so the quiz UI can show it (and the parser preserves it).
  if (node.type.name === 'listItem') {
    const $pos = doc.resolve(offset)
    const parent = $pos.parent
    const idx = $pos.index()
    const trimmed = textForFlashcardParsing.trim()

    if (parent.type.name === 'bulletList') {
      // Don't add a bullet if the text already starts with a list marker.
      if (!trimmed.startsWith('• ') && !/^\d+\.\s+/.test(trimmed)) {
        textForFlashcardParsing = `• ${trimmed}`
      }
    } else if (parent.type.name === 'orderedList') {
      const orderAttr = parent.attrs.order
      const start =
        typeof orderAttr === 'number' && Number.isFinite(orderAttr)
          ? orderAttr
          : 1
      // Don't add a number if the text already starts with a list marker.
      if (!/^\d+\.\s+/.test(trimmed) && !trimmed.startsWith('• ')) {
        textForFlashcardParsing = `${start + idx}. ${trimmed}`
      }
    }
  }
  const flashcardData = parseFlashcard(textForFlashcardParsing)

  return {
    nodeId,
    type: node.type.name,
    content: node.toJSON(),
    textContent,
    position,
    attrs: Object.keys(node.attrs).length > 1 ? node.attrs : undefined,
    // Flashcard fields from parser
    isCard: flashcardData.isCard,
    cardType: flashcardData.cardType,
    cardDirection: flashcardData.cardDirection,
    cardFront: flashcardData.cardFront,
    cardBack: flashcardData.cardBack,
    clozeOcclusions: flashcardData.clozeOcclusions,
  }
}

// Get all blocks from a document
// Traverse all nodes to find blocks with IDs (including nested blocks like list items)
function getAllBlocks(
  doc: ProseMirrorNode,
  attributeName: string,
): Map<string, BlockData> {
  const blocks = new Map<string, BlockData>()
  let position = 0

  doc.descendants((node, offset) => {
    const blockData = extractBlockData(
      node,
      doc,
      offset,
      position,
      attributeName,
    )
    if (blockData) {
      blocks.set(blockData.nodeId, blockData)
      position++ // Only increment position for nodes that have IDs

      // Important: avoid double-saving nested block nodes (e.g. listItem -> paragraph).
      // If a node is considered a block (has an ID), we treat it as the canonical block
      // and do NOT traverse into its children.
      return false
    }

    return
  })

  return blocks
}

// Compare two block contents to see if they're different
function blocksAreDifferent(a: BlockData, b: BlockData): boolean {
  return (
    a.type !== b.type ||
    a.textContent !== b.textContent ||
    a.position !== b.position ||
    JSON.stringify(a.content) !== JSON.stringify(b.content) ||
    // Check flashcard fields
    a.isCard !== b.isCard ||
    a.cardType !== b.cardType ||
    a.cardDirection !== b.cardDirection ||
    a.cardFront !== b.cardFront ||
    a.cardBack !== b.cardBack ||
    JSON.stringify(a.clozeOcclusions) !== JSON.stringify(b.clozeOcclusions)
  )
}

export const BlockSync = Extension.create<BlockSyncOptions>({
  name: 'blockSync',

  addOptions() {
    return {
      documentId: '' as Id<'documents'>,
      attributeName: 'blockId',
      debounceMs: 300,
      onBlockUpdate: () => {},
      onBlocksDelete: () => {},
      onInitialSync: () => {},
    }
  },

  addProseMirrorPlugins() {
    const {
      documentId,
      attributeName,
      debounceMs,
      onBlockUpdate,
      onBlocksDelete,
      onInitialSync,
    } = this.options

    // Validate that documentId is provided
    if (!documentId || documentId === '') {
      throw new Error(
        'BlockSync extension requires a valid documentId to be configured. ' +
          'Please provide documentId when configuring the extension.',
      )
    }

    let previousBlocks: Map<string, BlockData> = new Map()
    const pendingUpdates: Map<string, BlockData> = new Map()
    const pendingDeletes: Set<string> = new Set()
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let initialSyncDone = false

    const flushUpdates = () => {
      // Process updates
      if (pendingUpdates.size > 0) {
        pendingUpdates.forEach((block) => {
          onBlockUpdate(documentId, block)
        })
        pendingUpdates.clear()
      }

      // Process deletes
      if (pendingDeletes.size > 0) {
        onBlocksDelete(documentId, Array.from(pendingDeletes))
        pendingDeletes.clear()
      }
    }

    const scheduleFlush = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(flushUpdates, debounceMs)
    }

    return [
      new Plugin({
        key: blockSyncPluginKey,
        view: () => ({
          update: (view) => {
            const currentBlocks = getAllBlocks(view.state.doc, attributeName)

            // Initial sync - send all blocks
            if (!initialSyncDone) {
              initialSyncDone = true
              const allBlocks = Array.from(currentBlocks.values())
              onInitialSync(documentId, allBlocks)
              previousBlocks = currentBlocks
              return
            }

            // Find changed blocks
            currentBlocks.forEach((block, nodeId) => {
              const previousBlock = previousBlocks.get(nodeId)
              if (!previousBlock || blocksAreDifferent(previousBlock, block)) {
                pendingUpdates.set(nodeId, block)
                // Remove from pending deletes if it was there
                pendingDeletes.delete(nodeId)
              }
            })

            // Find deleted blocks
            previousBlocks.forEach((_, nodeId) => {
              if (!currentBlocks.has(nodeId)) {
                pendingDeletes.add(nodeId)
                // Remove from pending updates if it was there
                pendingUpdates.delete(nodeId)
              }
            })

            // Update previous state
            previousBlocks = currentBlocks

            // Schedule flush if there are pending changes
            if (pendingUpdates.size > 0 || pendingDeletes.size > 0) {
              scheduleFlush()
            }
          },
          destroy: () => {
            if (debounceTimer) {
              clearTimeout(debounceTimer)
              // Flush any pending changes on destroy
              flushUpdates()
            }
          },
        }),
      }),
    ]
  },
})
