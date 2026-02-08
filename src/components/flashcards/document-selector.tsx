import { FileText, GraduationCap } from 'lucide-react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FlashcardWithDocument } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pluralize } from '@/lib/pluralize'
import { cn } from '@/lib/utils'

interface DocumentSelectorProps {
  documents: Array<FlashcardWithDocument>
  selectedDocIds: Set<Id<'documents'>>
  onSelectionChange: (docIds: Set<Id<'documents'>>) => void
  onStartStudy: () => void
}

export function DocumentSelector({
  documents,
  selectedDocIds,
  onSelectionChange,
  onStartStudy,
}: DocumentSelectorProps) {
  const toggleDocument = (docId: Id<'documents'>) => {
    const newSelection = new Set(selectedDocIds)
    if (newSelection.has(docId)) {
      newSelection.delete(docId)
    } else {
      newSelection.add(docId)
    }
    onSelectionChange(newSelection)
  }

  const selectAll = () => {
    onSelectionChange(new Set(documents.map((d) => d.document._id)))
  }

  const selectNone = () => {
    onSelectionChange(new Set())
  }

  const totalCards = documents
    .filter((d) => selectedDocIds.has(d.document._id))
    .reduce((sum, d) => sum + d.flashcards.length, 0)
  const totalCardLabel = pluralize(totalCards, 'card')
  const selectedDocumentLabel = pluralize(selectedDocIds.size, 'document')

  if (documents.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="py-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">No flashcards found</h2>
          <p className="text-muted-foreground">
            Create flashcards in your documents using syntax like{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              Question {'>>'} Answer
            </code>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Select Documents to Study
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {documents.map(({ document, flashcards }) => {
            const isSelected = selectedDocIds.has(document._id)
            const count = flashcards.length
            const cardLabel = pluralize(count, 'card')
            return (
              <label
                key={document._id}
                className={cn(
                  'flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-accent/50',
                  isSelected && 'bg-accent/30',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleDocument(document._id)}
                />
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {document.title || 'Untitled'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {count} {cardLabel}
                </Badge>
              </label>
            )
          })}
        </div>

        {/* Footer with start button */}
        <div className="flex items-center justify-between border-t bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            {selectedDocIds.size === 0 ? (
              'Select documents to study'
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {totalCards}
                </span>{' '}
                {totalCardLabel} from{' '}
                <span className="font-medium text-foreground">
                  {selectedDocIds.size}
                </span>{' '}
                {selectedDocumentLabel}
              </>
            )}
          </p>
          <Button
            onClick={onStartStudy}
            disabled={selectedDocIds.size === 0}
            className="gap-2"
          >
            <GraduationCap className="h-4 w-4" />
            Start Studying
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
