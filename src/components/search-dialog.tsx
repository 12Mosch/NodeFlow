import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { FileText, Text } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { SEARCH_HIGHLIGHT_CLASS, escapeRegExp } from '../lib/utils'
import { useSearch } from './search-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'

const SNIPPET_MAX_LENGTH = 120
const SNIPPET_CONTEXT_BEFORE = 30

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
  const matchIndex = lowerText.indexOf(lowerQuery)

  // If no match found or query not found, return truncated text from start
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

  // Escape regex special characters
  const escaped = escapeRegExp(query)
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className={SEARCH_HIGHLIGHT_CLASS}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export function SearchDialog() {
  const { isOpen, close } = useSearch()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: results, isLoading } = useQuery({
    ...convexQuery(api.search.search, { query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
  })

  const handleSelect = (documentId: string) => {
    close()
    navigate({
      to: '/doc/$docId',
      params: { docId: documentId },
      search: { q: debouncedQuery },
    })
  }

  const hasResults =
    (results?.documents.length ?? 0) > 0 || (results?.blocks.length ?? 0) > 0
  const showEmpty = debouncedQuery.length >= 2 && !isLoading && !hasResults

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close()
          setSearchQuery('')
          setDebouncedQuery('')
        }
      }}
      title="Search"
      description="Search documents and content"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search documents..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {showEmpty && <CommandEmpty>No results found.</CommandEmpty>}

        {isLoading && debouncedQuery.length >= 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {results?.documents && results.documents.length > 0 && (
          <CommandGroup heading="Documents">
            {results.documents.map((doc) => (
              <CommandItem
                key={doc._id}
                value={`doc-${doc._id}-${doc.title}`}
                onSelect={() => handleSelect(doc._id)}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {highlightMatch(doc.title || 'Untitled', debouncedQuery)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results?.blocks && results.blocks.length > 0 && (
          <CommandGroup heading="Content">
            {results.blocks.map((block) => (
              <CommandItem
                key={block._id}
                value={`block-${block._id}-${block.textContent}`}
                onSelect={() => handleSelect(block.documentId)}
              >
                <Text className="mr-2 h-4 w-4 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs text-muted-foreground">
                    {highlightMatch(block.documentTitle, debouncedQuery)}
                  </span>
                  <span className="truncate">
                    {highlightMatch(
                      extractSnippet(block.textContent, debouncedQuery),
                      debouncedQuery,
                    )}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {debouncedQuery.length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search...
          </div>
        )}
      </CommandList>
    </CommandDialog>
  )
}
