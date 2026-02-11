import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import Fuse from 'fuse.js'
import { FileText, Text } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import {
  SEARCH_HIGHLIGHT_CLASS,
  findAllFuzzyMatches,
  findFuzzyMatchRange,
} from '../lib/utils'
import { setSearchQuery } from '../extensions/search-highlight'
import { useSearch } from './search-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import type { Id } from '../../convex/_generated/dataModel'
import type { IFuseOptions } from 'fuse.js'

const SNIPPET_MAX_LENGTH = 120
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
interface DocumentResult {
  _id: Id<'documents'>
  title: string
  updatedAt?: number
}

// Block type from Convex search results
interface BlockResult {
  _id: Id<'blocks'>
  documentId: Id<'documents'>
  documentTitle: string
  textContent: string
  type: string
}

// Search results type matching Convex return type
interface SearchResult {
  documents: Array<DocumentResult>
  blocks: Array<BlockResult>
}

/**
 * Type guard to check if a value is a valid DocumentResult.
 */
function isDocumentResult(value: unknown): value is DocumentResult {
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
function isBlockResult(value: unknown): value is BlockResult {
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
function isSearchResult(value: unknown): value is SearchResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  // Check documents array
  if (!Array.isArray(obj.documents)) {
    return false
  }

  // Check blocks array
  if (!Array.isArray(obj.blocks)) {
    return false
  }

  // Validate document structure
  for (const doc of obj.documents) {
    if (!isDocumentResult(doc)) {
      return false
    }
  }

  // Validate block structure
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
function extractSnippet(text: string, query: string): string {
  if (!text) {
    return text
  }

  // Case-insensitive search for the first occurrence
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  let matchIndex = lowerText.indexOf(lowerQuery)

  // If no exact match found, try fuzzy matching
  if (matchIndex === -1) {
    const fuzzyMatch = findFuzzyMatchRange(text, lowerQuery)
    if (fuzzyMatch) {
      matchIndex = fuzzyMatch.start
    }
  }

  // If no match found (exact or fuzzy), return truncated text from start
  if (matchIndex === -1) {
    return text.length > SNIPPET_MAX_LENGTH
      ? text.slice(0, SNIPPET_MAX_LENGTH) + '...'
      : text
  }

  // Calculate snippet boundaries around the match
  const snippetStart = Math.max(0, matchIndex - SNIPPET_CONTEXT_BEFORE)
  const snippetEnd = Math.min(text.length, snippetStart + SNIPPET_MAX_LENGTH)

  // Extract the snippet
  let snippet = text.slice(snippetStart, snippetEnd)

  // Add ellipsis at start if we didn't start from the beginning
  if (snippetStart > 0) {
    snippet = '...' + snippet
  }

  // Add ellipsis at end if we didn't reach the end
  if (snippetEnd < text.length) {
    snippet = snippet + '...'
  }

  return snippet
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text

  // Find all fuzzy matches in the text
  const matches = findAllFuzzyMatches(text, query, 0.5)

  // If no matches found, return text as-is
  if (matches.length === 0) {
    return text
  }

  // Build the result with highlighted matches
  const result: Array<React.ReactNode> = []
  let lastEnd = 0

  for (const { start, end } of matches) {
    // Add text before the match
    if (start > lastEnd) {
      result.push(text.slice(lastEnd, start))
    }

    // Add the highlighted match
    result.push(
      <span key={start} className={SEARCH_HIGHLIGHT_CLASS}>
        {text.slice(start, end)}
      </span>,
    )

    lastEnd = end
  }

  // Add any remaining text after the last match
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
function applyFuzzyFilter(
  results: SearchResult | undefined,
  query: string,
): SearchResult | undefined {
  if (!results || query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
    return results
  }

  const trimmedQuery = query.trim()

  // Create Fuse instances for documents and blocks
  const documentFuse = new Fuse(results.documents, {
    ...FUSE_OPTIONS,
    keys: ['title'],
  })

  const blockFuse = new Fuse(results.blocks, {
    ...FUSE_OPTIONS,
    keys: ['textContent'],
  })

  // Perform fuzzy search
  const documentMatches = documentFuse.search(trimmedQuery)
  const blockMatches = blockFuse.search(trimmedQuery)

  // Extract items from Fuse results (sorted by relevance score)
  const fuzzyDocuments = documentMatches.map((match) => match.item)
  const fuzzyBlocks = blockMatches.map((match) => match.item)

  // Fallback to original results if Fuse returns nothing
  return {
    documents: fuzzyDocuments.length > 0 ? fuzzyDocuments : results.documents,
    blocks: fuzzyBlocks.length > 0 ? fuzzyBlocks : results.blocks,
  }
}

export function SearchDialog() {
  const { isOpen, close } = useSearch()
  const navigate = useNavigate()
  const [searchQuery, setSearchQueryState] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Update search highlight in real-time as user types
  useEffect(() => {
    setSearchQuery(debouncedQuery)
  }, [debouncedQuery])

  // Clear search highlight when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  const normalizedQuery = debouncedQuery.trim()

  const { data: rawResults, isLoading } = useQuery(
    convexQuery(
      api.search.search,
      isOpen ? { query: normalizedQuery } : 'skip',
    ),
  )

  // Apply Fuse.js fuzzy filtering to Convex results
  const results = useMemo(() => {
    const typedResults = isSearchResult(rawResults) ? rawResults : undefined
    return applyFuzzyFilter(typedResults, normalizedQuery)
  }, [rawResults, normalizedQuery])

  const handleSelect = (documentId: string) => {
    close()
    navigate({
      to: '/doc/$docId',
      params: { docId: documentId },
      search: normalizedQuery.length > 0 ? { q: normalizedQuery } : undefined,
    })
  }

  const hasResults =
    (results?.documents.length ?? 0) > 0 || (results?.blocks.length ?? 0) > 0
  const showEmpty = !isLoading && !hasResults
  const isEmptyQuery = normalizedQuery.length === 0

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close()
          setSearchQueryState('')
          setDebouncedQuery('')
        }
      }}
      title="Search"
      description="Search documents and content"
      showCloseButton={false}
      className="rounded-2xl border border-border/70 bg-card/95 shadow-xl sm:max-w-2xl"
    >
      <div data-ph-mask>
        <CommandInput
          placeholder="Search documents..."
          value={searchQuery}
          onValueChange={setSearchQueryState}
          className="text-base"
        />
        <CommandList className="max-h-[65vh] p-1.5">
          {showEmpty && (
            <CommandEmpty className="rounded-lg border border-dashed border-border/70 bg-muted/25 py-8 text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>
          )}

          {isLoading && (
            <div className="rounded-lg border border-border/70 bg-muted/25 py-6 text-center text-sm text-muted-foreground">
              {isEmptyQuery ? 'Loading recent documents...' : 'Searching...'}
            </div>
          )}

          {results?.documents && results.documents.length > 0 && (
            <CommandGroup
              heading={isEmptyQuery ? 'Recent Documents' : 'Documents'}
              className="mb-1 rounded-lg border border-border/60 bg-card p-1.5"
            >
              {results.documents.map((doc) => (
                <CommandItem
                  key={doc._id}
                  value={`doc-${doc._id}-${doc.title}`}
                  onSelect={() => handleSelect(doc._id)}
                  className="rounded-md px-2.5 py-2.5"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {highlightMatch(doc.title || 'Untitled', normalizedQuery)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.blocks && results.blocks.length > 0 && !isEmptyQuery && (
            <CommandGroup
              heading="Content"
              className="rounded-lg border border-border/60 bg-card p-1.5"
            >
              {results.blocks.map((block) => (
                <CommandItem
                  key={block._id}
                  value={`block-${block._id}-${block.textContent}`}
                  onSelect={() => handleSelect(block.documentId)}
                  className="rounded-md px-2.5 py-2.5"
                >
                  <Text className="mr-2 h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs text-muted-foreground">
                      {highlightMatch(block.documentTitle, normalizedQuery)}
                    </span>
                    <span className="truncate">
                      {highlightMatch(
                        extractSnippet(block.textContent, normalizedQuery),
                        normalizedQuery,
                      )}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  )
}
