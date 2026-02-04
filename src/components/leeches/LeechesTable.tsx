import { LeechCardRow } from './LeechCardRow'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

interface LeechesTableProps {
  cards: Array<{
    cardState: Doc<'cardStates'>
    block: Doc<'blocks'>
    document: { _id: Id<'documents'>; title: string } | null
    retention: number | null
    leechReason: string
  }>
  selectedCards: Set<Id<'cardStates'>>
  onToggleSelect: (cardId: Id<'cardStates'>) => void
}

export function LeechesTable({
  cards,
  selectedCards,
  onToggleSelect,
}: LeechesTableProps) {
  if (cards.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No cards match the current filter
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-12 p-3 text-left text-xs font-medium text-muted-foreground">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Card
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Document
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Reason
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Lapses
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Retention
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="w-24 p-3 text-left text-xs font-medium text-muted-foreground">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cards.map((item) => (
              <LeechCardRow
                key={item.cardState._id}
                cardState={item.cardState}
                block={item.block}
                document={item.document}
                retention={item.retention}
                leechReason={item.leechReason}
                isSelected={selectedCards.has(item.cardState._id)}
                onToggleSelect={() => onToggleSelect(item.cardState._id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
