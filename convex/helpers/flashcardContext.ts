import type { Doc } from '../_generated/dataModel'

export interface BlockForFlashcardContext {
  nodeId: string
  textContent: string
  type: string
  position: number
  attrs?: unknown
}

type HeadingStackEntry = {
  level: number
  text: string
}

const OUTLINE_ANCESTOR_ATTR = 'outlineAncestorNodeIds'
const OUTLINE_ANCESTOR_PATH_ATTR = 'outlineAncestorPath'

function normalizeBlockText(textContent: string): string | null {
  const trimmed = textContent.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getHeadingLevel(attrs: unknown): number {
  if (!attrs || typeof attrs !== 'object') {
    return 1
  }

  const level = (attrs as { level?: unknown }).level
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    return 1
  }

  return Math.max(1, Math.floor(level))
}

function getOutlineAncestorNodeIds(attrs: unknown): Array<string> | null {
  if (!attrs || typeof attrs !== 'object') {
    return null
  }

  const value = (attrs as Record<string, unknown>)[OUTLINE_ANCESTOR_ATTR]
  if (value === undefined) {
    return null
  }

  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function getCachedAncestorPathFromAttrs(
  attrs: unknown,
): Array<string> | null {
  if (!attrs || typeof attrs !== 'object') {
    return null
  }

  const value = (attrs as Record<string, unknown>)[OUTLINE_ANCESTOR_PATH_ATTR]
  if (value === undefined) {
    return null
  }

  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function dedupeInOrder(items: Array<string>): Array<string> {
  const seen = new Set<string>()
  const deduped: Array<string> = []

  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    deduped.push(item)
  }

  return deduped
}

function buildHeadingFallbackByNodeId(
  sortedBlocks: Array<BlockForFlashcardContext>,
): Map<string, Array<string>> {
  const fallbackByNodeId = new Map<string, Array<string>>()
  const headingStack: Array<HeadingStackEntry> = []

  for (const block of sortedBlocks) {
    fallbackByNodeId.set(
      block.nodeId,
      headingStack.map((entry) => entry.text),
    )

    if (block.type !== 'heading') continue

    const headingText = normalizeBlockText(block.textContent)
    if (!headingText) continue

    const headingLevel = getHeadingLevel(block.attrs)
    while (
      headingStack.length > 0 &&
      headingStack[headingStack.length - 1].level >= headingLevel
    ) {
      headingStack.pop()
    }

    headingStack.push({ level: headingLevel, text: headingText })
  }

  return fallbackByNodeId
}

export function buildAncestorPathByNodeId(
  blocks: Array<BlockForFlashcardContext>,
): Map<string, Array<string>> {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position)
  const blockByNodeId = new Map(
    sortedBlocks.map((block) => [block.nodeId, block]),
  )
  const headingFallbackByNodeId = buildHeadingFallbackByNodeId(sortedBlocks)
  const ancestorPathByNodeId = new Map<string, Array<string>>()
  let previousBlock: BlockForFlashcardContext | null = null

  for (const block of sortedBlocks) {
    let resolvedPath: Array<string> | null = null
    const outlineAncestorNodeIds = getOutlineAncestorNodeIds(block.attrs)
    if (outlineAncestorNodeIds !== null) {
      const uniqueAncestorNodeIds = dedupeInOrder(outlineAncestorNodeIds)
      const resolvedAncestors = uniqueAncestorNodeIds
        .map((ancestorNodeId) => blockByNodeId.get(ancestorNodeId))
        .map((ancestorBlock) =>
          ancestorBlock ? normalizeBlockText(ancestorBlock.textContent) : null,
        )
        .filter((text): text is string => text !== null)

      if (resolvedAncestors.length > 0) {
        resolvedPath = resolvedAncestors
      }
    }

    if (resolvedPath === null) {
      const fallbackPath = headingFallbackByNodeId.get(block.nodeId) ?? []
      if (fallbackPath.length > 0) {
        resolvedPath = fallbackPath
      }
    }

    // Tab-indented paragraph blocks are represented as blockquotes and don't
    // always carry structural ancestry metadata. In that case, derive a
    // contextual path from the immediately previous block.
    if (resolvedPath === null && block.type === 'blockquote' && previousBlock) {
      const previousText = normalizeBlockText(previousBlock.textContent)
      if (previousText) {
        if (previousBlock.type === 'blockquote') {
          const previousPath =
            ancestorPathByNodeId.get(previousBlock.nodeId) ?? []
          resolvedPath = [...previousPath, previousText]
        } else {
          resolvedPath = [previousText]
        }
      }
    }

    if (resolvedPath && resolvedPath.length > 0) {
      ancestorPathByNodeId.set(block.nodeId, resolvedPath)
    }

    previousBlock = block
  }

  return ancestorPathByNodeId
}

export type FlashcardBlockWithAncestorPath = Doc<'blocks'> & {
  ancestorPath?: Array<string>
}
