import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { buildAncestorPathByNodeId } from '../../convex/helpers/flashcardContext'
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model'
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
const OUTLINE_ANCESTOR_PATH_ATTR = 'outlineAncestorPath'

// Serialize node text for search indexing - includes LaTeX content from math nodes
function serializeNodeTextForSearch(node: ProseMirrorNode): string {
  const type = node.type.name

  // Text leaf
  if (type === 'text') {
    return node.textContent
  }

  if (type === 'hardBreak') {
    return ' '
  }

  // Math nodes: include LaTeX content for search (without delimiters)
  if (type === 'inlineMath' || type === 'blockMath') {
    return node.attrs.latex || ''
  }

  // Recursively serialize children
  const parts: Array<string> = []
  node.forEach((child) => {
    const s = serializeNodeTextForSearch(child)
    if (s) parts.push(s)
  })
  return parts.join(' ')
}

function serializeNodeTextForFlashcards(node: ProseMirrorNode): string {
  const type = node.type.name

  // Text leaf
  if (type === 'text') {
    return node.textContent
  }

  if (type === 'hardBreak') {
    return '\n'
  }

  // Math nodes: preserve LaTeX delimiters for flashcard rendering
  if (type === 'inlineMath') {
    const latex = node.attrs.latex || ''
    return latex ? `$${latex}$` : ''
  }

  if (type === 'blockMath') {
    const latex = node.attrs.latex || ''
    return latex ? `$$${latex}$$` : ''
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

function getOutlineAncestorNodeIds(
  $pos: ResolvedPos,
  attributeName: string,
): Array<string> {
  const ancestorNodeIds: Array<string> = []
  const seen = new Set<string>()

  for (let depth = 1; depth < $pos.depth; depth++) {
    const ancestorNodeId = $pos.node(depth).attrs[attributeName]
    if (typeof ancestorNodeId !== 'string') continue
    const normalizedAncestorNodeId = ancestorNodeId.trim()
    if (normalizedAncestorNodeId.length === 0) continue
    if (seen.has(normalizedAncestorNodeId)) continue
    seen.add(normalizedAncestorNodeId)
    ancestorNodeIds.push(normalizedAncestorNodeId)
  }

  return ancestorNodeIds
}

function getExistingOutlineAncestorNodeIds(attrs: unknown): Array<string> {
  if (!attrs || typeof attrs !== 'object') return []

  const value = (attrs as Record<string, unknown>).outlineAncestorNodeIds
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const result: Array<string> = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function mergeAncestorNodeIds(
  primary: Array<string>,
  secondary: Array<string>,
): Array<string> {
  const seen = new Set<string>()
  const merged: Array<string> = []

  for (const candidate of [...primary, ...secondary]) {
    const normalized = candidate.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(normalized)
  }

  return merged
}

function areStringArraysEqual(
  a: Array<string> | null | undefined,
  b: Array<string> | null | undefined,
): boolean {
  if (!a || a.length === 0) return !b || b.length === 0
  if (!b || b.length === 0) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }

  return true
}

function areStringSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false

  for (const value of a) {
    if (!b.has(value)) return false
  }

  return true
}

function collectReferencedAncestorNodeIds(
  blocks: Map<string, BlockData>,
): Set<string> {
  const referencedAncestorNodeIds = new Set<string>()

  for (const block of blocks.values()) {
    const ancestorNodeIds = getExistingOutlineAncestorNodeIds(block.attrs)
    for (const ancestorNodeId of ancestorNodeIds) {
      referencedAncestorNodeIds.add(ancestorNodeId)
    }
  }

  return referencedAncestorNodeIds
}

function buildBlocksByPosition(
  blocks: Map<string, BlockData>,
): Map<number, BlockData> {
  const blocksByPosition = new Map<number, BlockData>()

  for (const block of blocks.values()) {
    blocksByPosition.set(block.position, block)
  }

  return blocksByPosition
}

function hasBlockquoteFallbackSuccessor(
  blocksByPosition: Map<number, BlockData>,
  position: number,
): boolean {
  const successor = blocksByPosition.get(position + 1)
  if (!successor || successor.type !== 'blockquote') return false
  return getExistingOutlineAncestorNodeIds(successor.attrs).length === 0
}

function shouldRecomputeAncestorPaths({
  changedNodeIds,
  deletedNodeIds,
  previousBlocks,
  currentBlocks,
  previousReferencedAncestorNodeIds,
  currentReferencedAncestorNodeIds,
}: {
  changedNodeIds: Set<string>
  deletedNodeIds: Set<string>
  previousBlocks: Map<string, BlockData>
  currentBlocks: Map<string, BlockData>
  previousReferencedAncestorNodeIds: Set<string>
  currentReferencedAncestorNodeIds: Set<string>
}): boolean {
  if (deletedNodeIds.size > 0) return true
  if (changedNodeIds.size === 0) return false
  if (currentBlocks.size !== previousBlocks.size) return true
  if (
    !areStringSetsEqual(
      previousReferencedAncestorNodeIds,
      currentReferencedAncestorNodeIds,
    )
  ) {
    return true
  }

  const previousBlocksByPosition = buildBlocksByPosition(previousBlocks)
  const currentBlocksByPosition = buildBlocksByPosition(currentBlocks)

  for (const nodeId of changedNodeIds) {
    const previousBlock = previousBlocks.get(nodeId)
    const currentBlock = currentBlocks.get(nodeId)

    if (!previousBlock || !currentBlock) return true
    if (previousBlock.position !== currentBlock.position) return true
    if (previousBlock.type !== currentBlock.type) return true

    const previousOutlineAncestorNodeIds = getExistingOutlineAncestorNodeIds(
      previousBlock.attrs,
    )
    const currentOutlineAncestorNodeIds = getExistingOutlineAncestorNodeIds(
      currentBlock.attrs,
    )
    if (
      !areStringArraysEqual(
        previousOutlineAncestorNodeIds,
        currentOutlineAncestorNodeIds,
      )
    ) {
      return true
    }

    if (
      (currentBlock.type === 'heading' || previousBlock.type === 'heading') &&
      !areAttrsEqual(previousBlock.attrs, currentBlock.attrs)
    ) {
      return true
    }

    if (previousBlock.textContent === currentBlock.textContent) continue

    if (currentBlock.type === 'heading' || previousBlock.type === 'heading') {
      return true
    }

    if (
      currentBlock.type === 'blockquote' ||
      previousBlock.type === 'blockquote'
    ) {
      return true
    }

    if (
      currentReferencedAncestorNodeIds.has(nodeId) ||
      previousReferencedAncestorNodeIds.has(nodeId)
    ) {
      return true
    }

    if (
      hasBlockquoteFallbackSuccessor(
        previousBlocksByPosition,
        previousBlock.position,
      ) ||
      hasBlockquoteFallbackSuccessor(
        currentBlocksByPosition,
        currentBlock.position,
      )
    ) {
      return true
    }
  }

  return false
}

function withAncestorPath(
  block: BlockData,
  ancestorPath: Array<string> | undefined,
): BlockData {
  const baseAttrs =
    block.attrs && typeof block.attrs === 'object'
      ? { ...(block.attrs as Record<string, unknown>) }
      : {}

  if (ancestorPath && ancestorPath.length > 0) {
    baseAttrs[OUTLINE_ANCESTOR_PATH_ATTR] = ancestorPath
  } else {
    delete baseAttrs[OUTLINE_ANCESTOR_PATH_ATTR]
  }

  return {
    ...block,
    attrs: Object.keys(baseAttrs).length > 0 ? baseAttrs : undefined,
  }
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForComparison(
          (value as Record<string, unknown>)[key],
        )
        return acc
      }, {})
  }

  return value
}

function areAttrsEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(normalizeForComparison(a)) ===
    JSON.stringify(normalizeForComparison(b))
  )
}

// Extract block data from a ProseMirror node
interface ExtractedBlockData {
  blockData: BlockData
  depth: number
}

function extractBlockData(
  node: ProseMirrorNode,
  doc: ProseMirrorNode,
  offset: number,
  position: number,
  attributeName: string,
): ExtractedBlockData | null {
  const nodeId = node.attrs[attributeName]
  if (!nodeId) return null
  const $pos = doc.resolve(offset)
  const depth = $pos.depth
  const outlineAncestorNodeIds = getOutlineAncestorNodeIds($pos, attributeName)
  const attrsWithoutNodeId: Record<string, unknown> = Object.fromEntries(
    Object.entries(node.attrs).filter(([key]) => key !== attributeName),
  )

  if (outlineAncestorNodeIds.length > 0) {
    attrsWithoutNodeId.outlineAncestorNodeIds = outlineAncestorNodeIds
  }

  // Use serializeNodeTextForSearch to include LaTeX content from math nodes,
  // but parse flashcards from a newline-preserving representation so multi-line
  // cards (e.g. list children) can roundtrip as `\n` instead of concatenated words.
  const textContent = serializeNodeTextForSearch(node)
  let textForFlashcardParsing = serializeNodeTextForFlashcards(node)

  // If the block itself is a list item, include the bullet/number marker on the
  // first line so the quiz UI can show it (and the parser preserves it).
  if (node.type.name === 'listItem') {
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
    depth,
    blockData: {
      nodeId,
      type: node.type.name,
      content: node.toJSON(),
      textContent,
      position,
      attrs:
        Object.keys(attrsWithoutNodeId).length > 0
          ? attrsWithoutNodeId
          : undefined,
      // Flashcard fields from parser
      isCard: flashcardData.isCard,
      cardType: flashcardData.cardType,
      cardDirection: flashcardData.cardDirection,
      cardFront: flashcardData.cardFront,
      cardBack: flashcardData.cardBack,
      clozeOcclusions: flashcardData.clozeOcclusions,
    },
  }
}

// Get all blocks from a document
// Traverse all nodes to find blocks with IDs (including nested blocks like list items)
function getAllBlocks(
  doc: ProseMirrorNode,
  attributeName: string,
): Map<string, BlockData> {
  const blocks = new Map<string, BlockData>()
  const outlineStack: Array<{ depth: number; nodeId: string }> = []
  let position = 0

  doc.descendants((node, offset) => {
    const extractedBlockData = extractBlockData(
      node,
      doc,
      offset,
      position,
      attributeName,
    )
    if (extractedBlockData) {
      const { blockData, depth: currentDepth } = extractedBlockData
      while (
        outlineStack.length > 0 &&
        outlineStack[outlineStack.length - 1].depth >= currentDepth
      ) {
        outlineStack.pop()
      }

      const structuralAncestorNodeIds = outlineStack.map(
        (entry) => entry.nodeId,
      )
      const parsedAncestorNodeIds = getExistingOutlineAncestorNodeIds(
        blockData.attrs,
      )
      const mergedAncestorNodeIds = mergeAncestorNodeIds(
        parsedAncestorNodeIds,
        structuralAncestorNodeIds,
      )
      const baseAttrs =
        blockData.attrs && typeof blockData.attrs === 'object'
          ? { ...(blockData.attrs as Record<string, unknown>) }
          : {}

      if (mergedAncestorNodeIds.length > 0) {
        baseAttrs.outlineAncestorNodeIds = mergedAncestorNodeIds
      } else {
        delete baseAttrs.outlineAncestorNodeIds
      }

      blockData.attrs =
        Object.keys(baseAttrs).length > 0 ? baseAttrs : undefined

      blocks.set(blockData.nodeId, blockData)
      position++ // Only increment position for nodes that have IDs
      outlineStack.push({ depth: currentDepth, nodeId: blockData.nodeId })

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
    !areAttrsEqual(a.attrs, b.attrs) ||
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
    let ancestorPathByNodeId = new Map<string, Array<string>>()
    let referencedAncestorNodeIds = new Set<string>()

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
          update: (view, previousState) => {
            if (initialSyncDone && previousState.doc.eq(view.state.doc)) return

            const currentBlocks = getAllBlocks(view.state.doc, attributeName)
            const changedNodeIds = new Set<string>()
            const deletedNodeIds = new Set<string>()
            const currentReferencedAncestorNodeIds =
              collectReferencedAncestorNodeIds(currentBlocks)

            // Initial sync - send all blocks
            if (!initialSyncDone) {
              initialSyncDone = true
              ancestorPathByNodeId = buildAncestorPathByNodeId(
                Array.from(currentBlocks.values()),
              )
              const allBlocks = Array.from(currentBlocks.values()).map(
                (block) =>
                  withAncestorPath(
                    block,
                    ancestorPathByNodeId.get(block.nodeId),
                  ),
              )
              onInitialSync(documentId, allBlocks)
              previousBlocks = currentBlocks
              referencedAncestorNodeIds = currentReferencedAncestorNodeIds
              return
            }

            // Find changed blocks
            currentBlocks.forEach((block, nodeId) => {
              const previousBlock = previousBlocks.get(nodeId)
              if (!previousBlock || blocksAreDifferent(previousBlock, block)) {
                changedNodeIds.add(nodeId)
              }
            })

            // Find deleted blocks
            previousBlocks.forEach((_, nodeId) => {
              if (!currentBlocks.has(nodeId)) {
                deletedNodeIds.add(nodeId)
              }
            })

            const recomputeAncestorPaths = shouldRecomputeAncestorPaths({
              changedNodeIds,
              deletedNodeIds,
              previousBlocks,
              currentBlocks,
              previousReferencedAncestorNodeIds: referencedAncestorNodeIds,
              currentReferencedAncestorNodeIds,
            })

            const previousAncestorPathByNodeId = ancestorPathByNodeId
            if (recomputeAncestorPaths) {
              ancestorPathByNodeId = buildAncestorPathByNodeId(
                Array.from(currentBlocks.values()),
              )
            }

            // Queue content updates
            for (const nodeId of changedNodeIds) {
              const block = currentBlocks.get(nodeId)
              if (!block) continue
              pendingUpdates.set(
                nodeId,
                withAncestorPath(block, ancestorPathByNodeId.get(nodeId)),
              )
              pendingDeletes.delete(nodeId)
            }

            // Queue blocks whose ancestor path changed due to outline context updates
            if (recomputeAncestorPaths) {
              currentBlocks.forEach((block, nodeId) => {
                if (changedNodeIds.has(nodeId)) return

                const previousPath = previousAncestorPathByNodeId.get(nodeId)
                const currentPath = ancestorPathByNodeId.get(nodeId)
                if (areStringArraysEqual(previousPath, currentPath)) return

                pendingUpdates.set(nodeId, withAncestorPath(block, currentPath))
                pendingDeletes.delete(nodeId)
              })
            }

            // Queue deletes
            for (const nodeId of deletedNodeIds) {
              pendingDeletes.add(nodeId)
              pendingUpdates.delete(nodeId)
            }

            // Update previous state
            previousBlocks = currentBlocks
            referencedAncestorNodeIds = currentReferencedAncestorNodeIds

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
