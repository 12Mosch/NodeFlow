import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { FileText, Text } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useSearch } from './search-provider'
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
    navigate({ to: '/doc/$docId', params: { docId: documentId } })
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
                <span className="truncate">{doc.title || 'Untitled'}</span>
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
                    {block.documentTitle}
                  </span>
                  <span className="truncate">{block.textContent}</span>
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
