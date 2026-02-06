import { useMutation } from 'convex/react'
import { CheckCircle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'

interface BulkActionsToolbarProps {
  selectedCount: number
  selectedCardIds: Array<Id<'cardStates'>>
  onClearSelection: () => void
}

export function BulkActionsToolbar({
  selectedCount,
  selectedCardIds,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const bulkSuspend = useMutation(
    api.cardStates.bulkSuspendCards,
  ).withOptimisticUpdate((localStore, args) => {
    const cards = localStore.getQuery(api.cardStates.listLeechCards, {})
    if (cards) {
      localStore.setQuery(
        api.cardStates.listLeechCards,
        {},
        cards.map((item) =>
          args.cardStateIds.includes(item.cardState._id)
            ? {
                ...item,
                cardState: { ...item.cardState, suspended: args.suspend },
              }
            : item,
        ),
      )

      const stats = localStore.getQuery(api.cardStates.getLeechStats, {})
      if (stats) {
        const changedCount = cards.filter(
          (item) =>
            args.cardStateIds.includes(item.cardState._id) &&
            item.cardState.suspended !== args.suspend,
        ).length
        localStore.setQuery(
          api.cardStates.getLeechStats,
          {},
          {
            ...stats,
            suspendedCount: args.suspend
              ? stats.suspendedCount + changedCount
              : stats.suspendedCount - changedCount,
          },
        )
      }
    }
  })

  const handleBulkUnsuspend = async () => {
    await bulkSuspend({
      cardStateIds: selectedCardIds,
      suspend: false,
    })
    onClearSelection()
  }

  const handleBulkSuspend = async () => {
    await bulkSuspend({
      cardStateIds: selectedCardIds,
      suspend: true,
    })
    onClearSelection()
  }

  return (
    <div className="sticky top-14 z-40 rounded-xl border border-border/70 bg-background/90 shadow-xs backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkSuspend}
            className="gap-1"
          >
            Suspend Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkUnsuspend}
            className="gap-1"
          >
            <CheckCircle className="h-3 w-3" />
            Unsuspend Selected
          </Button>
        </div>
      </div>
    </div>
  )
}
