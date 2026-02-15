import { createElement } from 'react'
import Fuse from 'fuse.js'
import {
  SEARCH_HIGHLIGHT_CLASS,
  findAllFuzzyMatches,
  findFuzzyMatchRange,
} from '../lib/utils'
import type { Id } from '../../convex/_generated/dataModel'
import type { ReactNode } from 'react'
import type { IFuseOptions } from 'fuse.js'

export const SNIPPET_MAX_LENGTH = 120
const SNIPPET_CONTEXT_BEFORE = 30
const MIN_SEARCH_QUERY_LENGTH = 2

// Fuse.js configuration for typo tolerance
const FUSE_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
}

// Document type from Convex search results
export interface DocumentResult {
  _id: Id<'documents'>
  title: string
  updatedAt?: number
}

// Block type from Convex search results
export interface BlockResult {
  _id: Id<'blocks'>
  documentId: Id<'documents'>
  documentTitle: string
  textContent: string
  type: string
}

// Search results type matching Convex return type
export interface SearchResult {
  documents: Array<DocumentResult>
  blocks: Array<BlockResult>
}

/**
 * Type guard to check if a value is a valid DocumentResult.
 */
export function isDocumentResult(value: unknown): value is DocumentResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const doc = value as Record<string, unknown>
  if (typeof doc._id !== 'string') {
    return false
  }
  if (typeof doc.title !== 'string') {
    return false
  }
  if (doc.updatedAt !== undefined && typeof doc.updatedAt !== 'number') {
    return false
  }
  return true
}

/**
 * Type guard to check if a value is a valid BlockResult.
 */
export function isBlockResult(value: unknown): value is BlockResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const block = value as Record<string, unknown>
  if (typeof block._id !== 'string') {
    return false
  }
  if (typeof block.documentId !== 'string') {
    return false
  }
  if (typeof block.documentTitle !== 'string') {
    return false
  }
  if (typeof block.textContent !== 'string') {
    return false
  }
  if (typeof block.type !== 'string') {
    return false
  }
  return true
}

/**
 * Type guard to check if a value is a valid SearchResult.
 * Validates the shape of the object at runtime.
 */
export function isSearchResult(value: unknown): value is SearchResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  if (!Array.isArray(obj.documents)) {
    return false
  }
  if (!Array.isArray(obj.blocks)) {
    return false
  }

  for (const doc of obj.documents) {
    if (!isDocumentResult(doc)) {
      return false
    }
  }

  for (const block of obj.blocks) {
    if (!isBlockResult(block)) {
      return false
    }
  }

  return true
}

/**
 * Extract a snippet of text around the first occurrence of the search query.
 * Returns the snippet with "..." prefix/suffix if the text is truncated.
 */
export function extractSnippet(text: string, query: string): string {
  if (!text) {
    return text
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  let matchIndex = lowerText.indexOf(lowerQuery)

  if (matchIndex === -1) {
    const fuzzyMatch = findFuzzyMatchRange(text, lowerQuery)
    if (fuzzyMatch) {
      matchIndex = fuzzyMatch.start
    }
  }

  if (matchIndex === -1) {
    return text.length > SNIPPET_MAX_LENGTH
      ? text.slice(0, SNIPPET_MAX_LENGTH) + '...'
      : text
  }

  const snippetStart = Math.max(0, matchIndex - SNIPPET_CONTEXT_BEFORE)
  const snippetEnd = Math.min(text.length, snippetStart + SNIPPET_MAX_LENGTH)

  let snippet = text.slice(snippetStart, snippetEnd)

  if (snippetStart > 0) {
    snippet = '...' + snippet
  }
  if (snippetEnd < text.length) {
    snippet = snippet + '...'
  }

  return snippet
}

export function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim() || !text) return text

  const matches = findAllFuzzyMatches(text, query, 0.5)

  if (matches.length === 0) {
    return text
  }

  const result: Array<ReactNode> = []
  let lastEnd = 0

  for (const { start, end } of matches) {
    if (start > lastEnd) {
      result.push(text.slice(lastEnd, start))
    }

    result.push(
      createElement(
        'span',
        { key: start, className: SEARCH_HIGHLIGHT_CLASS },
        text.slice(start, end),
      ),
    )

    lastEnd = end
  }

  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd))
  }

  return result
}

/**
 * Apply Fuse.js fuzzy filtering to search results.
 * Documents are searched by title, blocks by textContent.
 * Falls back to original results if Fuse returns nothing.
 */
export function applyFuzzyFilter(
  results: SearchResult | undefined,
  query: string,
): SearchResult | undefined {
  if (!results || query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
    return results
  }

  const trimmedQuery = query.trim()

  // Fuse indexes are rebuilt per call; callers should keep this memoized.
  const documentFuse = new Fuse(results.documents, {
    ...FUSE_OPTIONS,
    keys: ['title'],
  })

  const blockFuse = new Fuse(results.blocks, {
    ...FUSE_OPTIONS,
    keys: ['textContent'],
  })

  const documentMatches = documentFuse.search(trimmedQuery)
  const blockMatches = blockFuse.search(trimmedQuery)

  const fuzzyDocuments = documentMatches.map((match) => match.item)
  const fuzzyBlocks = blockMatches.map((match) => match.item)

  return {
    documents: fuzzyDocuments.length > 0 ? fuzzyDocuments : results.documents,
    blocks: fuzzyBlocks.length > 0 ? fuzzyBlocks : results.blocks,
  }
}
