import { useMutation } from 'convex/react'
import { Link } from '@tanstack/react-router'
import { Ban, CheckCircle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LeechCardRowProps {
  cardState: Doc<'cardStates'>
  block: Doc<'blocks'>
  document: { _id: Id<'documents'>; title: string } | null
  retention: number | null
  leechReason: string
  isSelected: boolean
  onToggleSelect: () => void
}

export function LeechCardRow({
  cardState,
  block,
  document,
  retention,
  leechReason,
  isSelected,
  onToggleSelect,
}: LeechCardRowProps) {
  const suspendCard = useMutation(
    api.cardStates.suspendCard,
  ).withOptimisticUpdate((localStore, args) => {
    const cards = localStore.getQuery(api.cardStates.listLeechCards, {})
    if (cards) {
      localStore.setQuery(
        api.cardStates.listLeechCards,
        {},
        cards.map((item) =>
          item.cardState._id === args.cardStateId
            ? {
                ...item,
                cardState: { ...item.cardState, suspended: args.suspend },
              }
            : item,
        ),
      )
    }

    const stats = localStore.getQuery(api.cardStates.getLeechStats, {})
    if (stats) {
      localStore.setQuery(
        api.cardStates.getLeechStats,
        {},
        {
          ...stats,
          suspendedCount: args.suspend
            ? stats.suspendedCount + 1
            : stats.suspendedCount - 1,
        },
      )
    }
  })

  const handleToggleSuspend = async () => {
    await suspendCard({
      cardStateId: cardState._id,
      suspend: !cardState.suspended,
    })
  }

  // Get card content preview
  const getCardPreview = () => {
    if (block.cardType === 'cloze') {
      return block.cardFront || 'Cloze card'
    }
    if (cardState.direction === 'forward') {
      return `${block.cardFront || ''} → ${block.cardBack || ''}`
    }
    return `${block.cardBack || ''} → ${block.cardFront || ''}`
  }

  // Get retention color class
  const getRetentionColor = () => {
    if (retention === null) return 'text-muted-foreground'
    if (retention < 40) return 'text-destructive'
    if (retention < 60) return 'text-amber-700 dark:text-amber-400'
    if (retention < 80) return 'text-yellow-700 dark:text-yellow-400'
    return 'text-emerald-700 dark:text-emerald-400'
  }

  // Get leech reason badge variant
  const getReasonVariant = (): 'default' | 'destructive' | 'secondary' => {
    if (leechReason.includes('High lapse')) return 'destructive'
    if (leechReason.includes('Low retention')) return 'secondary'
    return 'default'
  }

  return (
    <tr
      className={cn(
        'group transition-colors',
        isSelected ? 'bg-muted/35' : 'hover:bg-muted/25',
      )}
    >
      <td className="px-4 py-3 align-top">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-xl truncate text-sm font-medium">
          {getCardPreview()}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {cardState.direction === 'forward' ? 'Front → Back' : 'Back → Front'}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        {document ? (
          <Link
            to="/doc/$docId"
            params={{ docId: document._id }}
            className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {document.title}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">(Unknown)</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <Badge variant={getReasonVariant()} className="text-xs">
          {leechReason}
        </Badge>
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`text-sm font-medium ${
            cardState.lapses > 5
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground'
          }`}
        >
          {cardState.lapses}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`text-sm font-medium ${getRetentionColor()}`}>
          {retention !== null ? `${retention}%` : 'N/A'}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        {cardState.suspended ? (
          <Badge variant="destructive" className="text-xs">
            Suspended
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Active
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <Button
          variant={cardState.suspended ? 'outline' : 'destructive'}
          size="sm"
          onClick={handleToggleSuspend}
          className="h-8 gap-1.5"
        >
          {cardState.suspended ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Unsuspend
            </>
          ) : (
            <>
              <Ban className="h-3 w-3" />
              Suspend
            </>
          )}
        </Button>
      </td>
    </tr>
  )
}
