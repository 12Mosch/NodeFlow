import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Id } from '../../convex/_generated/dataModel'

// Types for block data
export interface BlockData {
  nodeId: string
  type: string
  content: any
  textContent: string
  position: number
  attrs?: any
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

// Extract block data from a ProseMirror node
function extractBlockData(
  node: ProseMirrorNode,
  position: number,
  attributeName: string,
): BlockData | null {
  const nodeId = node.attrs[attributeName]
  if (!nodeId) return null

  return {
    nodeId,
    type: node.type.name,
    content: node.toJSON(),
    textContent: node.textContent,
    position,
    attrs: Object.keys(node.attrs).length > 1 ? node.attrs : undefined,
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

  doc.descendants((node, _offset) => {
    const blockData = extractBlockData(node, position, attributeName)
    if (blockData) {
      blocks.set(blockData.nodeId, blockData)
      position++ // Only increment position for nodes that have IDs
    }
  })

  return blocks
}

// Compare two block contents to see if they're different
function blocksAreDifferent(a: BlockData, b: BlockData): boolean {
  return (
    a.type !== b.type ||
    a.textContent !== b.textContent ||
    a.position !== b.position ||
    JSON.stringify(a.content) !== JSON.stringify(b.content)
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
