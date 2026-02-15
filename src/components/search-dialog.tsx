import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { FileText, Text } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { setSearchQuery } from '../extensions/search-highlight'
import { useSearch } from './search-provider'
import {
  applyFuzzyFilter,
  extractSnippet,
  highlightMatch,
  isSearchResult,
} from './search-dialog.utils'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'

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
      <div data-ph-mask className="ph-mask ph-no-capture">
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
