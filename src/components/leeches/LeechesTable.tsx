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
      <div className="rounded-xl border border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
        No cards match the current filter
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border/70 bg-muted/35">
            <tr className="text-left">
              <th className="w-12 px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Card
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Document
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Reason
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Lapses
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Retention
              </th>
              <th className="px-4 py-3.5 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Status
              </th>
              <th className="w-28 px-4 py-3.5 text-left text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
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
