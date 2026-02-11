import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { FileText, Search } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Editor } from '@tiptap/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DocumentLinkPopoverProps {
  editor: Editor
  onClose: () => void
  onLinkApplied?: () => void
  currentDocumentId?: string | null
}

export function DocumentLinkPopover({
  editor,
  onClose,
  onLinkApplied,
  currentDocumentId,
}: DocumentLinkPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search documents
  const { data: searchResults, isLoading: isSearching } = useQuery(
    convexQuery(
      api.search.search,
      debouncedQuery.length >= 2
        ? { query: debouncedQuery, documentLimit: 10 }
        : 'skip',
    ),
  )

  // Get recent documents when not searching
  const { data: recentDocs } = useQuery({
    ...convexQuery(api.documents.list, {
      paginationOpts: { numItems: 10, cursor: null },
    }),
  })

  // Determine which documents to show
  const documents =
    debouncedQuery.length >= 2
      ? (searchResults?.documents ?? [])
      : (recentDocs?.page ?? [])

  // Derive clamped index during render (no state sync needed)
  const clampedIndex =
    documents.length === 0 ? 0 : Math.min(selectedIndex, documents.length - 1)

  const handleSelectDocument = (docId: string) => {
    // Signal that a link is being applied (before setting to ensure cleanup is skipped)
    onLinkApplied?.()
    // Use type assertion since documentId is added by ExtendedLink extension
    editor
      .chain()
      .focus()
      .setLink({
        href: `/doc/${docId}`,
        documentId: docId,
      } as { href: string; documentId: string })
      .run()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (documents.length > 0) {
        setSelectedIndex(Math.min(clampedIndex + 1, documents.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (documents.length > 0) {
        setSelectedIndex(Math.max(clampedIndex - 1, 0))
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (clampedIndex >= 0 && clampedIndex < documents.length) {
        const selectedDoc = documents[clampedIndex]
        handleSelectDocument(selectedDoc._id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div data-ph-mask className="ph-mask ph-no-capture flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-8"
          autoFocus
        />
      </div>

      <div className="max-h-48 overflow-y-auto">
        {isSearching && debouncedQuery.length >= 2 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {debouncedQuery.length >= 2 &&
          !isSearching &&
          documents.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No documents found
            </div>
          )}

        {debouncedQuery.length < 2 && documents.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No documents yet
          </div>
        )}

        {documents.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {debouncedQuery.length < 2 && (
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Recent documents
              </div>
            )}
            {documents.map((doc, index) => (
              <button
                key={doc._id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                  index === clampedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50',
                  currentDocumentId === doc._id &&
                    'border-l-2 border-primary pl-1.5',
                )}
                onClick={() => handleSelectDocument(doc._id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {debouncedQuery.length < 2 && debouncedQuery.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  )
}
