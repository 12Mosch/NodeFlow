import { useMemo, useState } from 'react'
import { FileText, Loader2, Search } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'
import { useIntersectionObserver } from '@/hooks/use-intersection-observer'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'

interface Document {
  _id: Id<'documents'>
  title: string
}

interface ExamDocumentSelectorProps {
  documents: Array<Document>
  selectedIds: Array<Id<'documents'>>
  onSelectionChange: (ids: Array<Id<'documents'>>) => void
  /** Whether there are more documents to load */
  hasMore?: boolean
  /** Whether more documents are currently being fetched */
  isFetchingMore?: boolean
  /** Callback to load more documents */
  onLoadMore?: () => void
}

export function ExamDocumentSelector({
  documents,
  selectedIds,
  onSelectionChange,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
}: ExamDocumentSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Intersection observer for infinite scroll
  const sentinelRef = useIntersectionObserver({
    onIntersect: () => onLoadMore?.(),
    enabled: hasMore && !isFetchingMore && !searchQuery.trim(),
  })

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents
    }
    const query = searchQuery.toLowerCase()
    return documents.filter((doc) => doc.title.toLowerCase().includes(query))
  }, [documents, searchQuery])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const handleToggle = (docId: Id<'documents'>) => {
    if (selectedSet.has(docId)) {
      onSelectionChange(selectedIds.filter((id) => id !== docId))
    } else {
      onSelectionChange([...selectedIds, docId])
    }
  }

  const handleSelectAll = () => {
    const filteredIds = filteredDocuments.map((d) => d._id)
    const allSelected = filteredIds.every((id) => selectedSet.has(id))

    if (allSelected) {
      // Deselect all filtered documents
      onSelectionChange(selectedIds.filter((id) => !filteredIds.includes(id)))
    } else {
      // Select all filtered documents
      const newSelection = new Set(selectedIds)
      filteredIds.forEach((id) => {
        newSelection.add(id)
      })
      onSelectionChange(Array.from(newSelection))
    }
  }

  const allFiltered = filteredDocuments.map((d) => d._id)
  const allFilteredSelected =
    allFiltered.length > 0 && allFiltered.every((id) => selectedSet.has(id))
  const someFilteredSelected =
    allFiltered.some((id) => selectedSet.has(id)) && !allFilteredSelected

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {filteredDocuments.length > 0 && (
        <div className="flex items-center gap-2 border-b pb-2">
          <Checkbox
            checked={allFilteredSelected}
            indeterminate={someFilteredSelected}
            onCheckedChange={handleSelectAll}
          />
          <Label
            className="cursor-pointer text-sm text-muted-foreground"
            onClick={handleSelectAll}
          >
            Select all ({filteredDocuments.length})
          </Label>
        </div>
      )}

      <ScrollArea className="h-50 w-full rounded-md border p-2">
        {filteredDocuments.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {searchQuery
              ? 'No documents match your search'
              : 'No documents found'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredDocuments.map((doc) => (
              <label
                key={doc._id}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
              >
                <Checkbox
                  checked={selectedSet.has(doc._id)}
                  onCheckedChange={() => handleToggle(doc._id)}
                />
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {doc.title || 'Untitled'}
                </span>
              </label>
            ))}
            {/* Sentinel for infinite scroll - only show when not searching */}
            {!searchQuery.trim() && hasMore && (
              <div ref={sentinelRef} className="h-1" />
            )}
            {isFetchingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {selectedIds.length} document{selectedIds.length !== 1 ? 's' : ''}{' '}
        selected
      </p>
    </div>
  )
}
