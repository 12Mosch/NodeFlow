import { useMutation } from 'convex/react'
import { Link } from '@tanstack/react-router'
import { Ban, CheckCircle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

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
    if (retention < 60) return 'text-amber-600'
    if (retention < 80) return 'text-yellow-600'
    return 'text-emerald-600'
  }

  // Get leech reason badge variant
  const getReasonVariant = (): 'default' | 'destructive' | 'secondary' => {
    if (leechReason.includes('High lapse')) return 'destructive'
    if (leechReason.includes('Low retention')) return 'secondary'
    return 'default'
  }

  return (
    <tr className="group border-b transition-colors hover:bg-muted/50">
      <td className="p-3">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </td>
      <td className="p-3">
        <div className="max-w-md truncate text-sm">{getCardPreview()}</div>
        <div className="text-xs text-muted-foreground">
          {cardState.direction === 'forward' ? 'Front → Back' : 'Back → Front'}
        </div>
      </td>
      <td className="p-3">
        {document ? (
          <Link
            to="/doc/$docId"
            params={{ docId: document._id }}
            className="text-sm text-primary hover:underline"
          >
            {document.title}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">(Unknown)</span>
        )}
      </td>
      <td className="p-3">
        <Badge variant={getReasonVariant()} className="text-xs">
          {leechReason}
        </Badge>
      </td>
      <td className="p-3">
        <span
          className={`text-sm font-medium ${
            cardState.lapses > 5
              ? 'text-amber-600 dark:text-amber-500'
              : 'text-muted-foreground'
          }`}
        >
          {cardState.lapses}
        </span>
      </td>
      <td className="p-3">
        <span className={`text-sm font-medium ${getRetentionColor()}`}>
          {retention !== null ? `${retention}%` : 'N/A'}
        </span>
      </td>
      <td className="p-3">
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
      <td className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleSuspend}
          className="h-8 gap-1"
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
