import { useMutation } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { RatingButtons } from './rating-buttons'
import type { LearnCard as LearnCardType, Rating } from './types'
import type { FlashcardBaseData } from '@/components/flashcards/types'
import { FlashcardBase } from '@/components/flashcards/flashcard-base'
import { STATE_COLORS, STATE_LABELS } from '@/components/flashcards/constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LearnCardProps {
  card: LearnCardType
  onRate: (rating: Rating) => void
  isExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Rating that was just triggered via keyboard - causes a flash effect */
  activeRating?: Rating | null
}

export function LearnCard({
  card,
  onRate,
  isExpanded,
  onExpandedChange,
  activeRating,
}: LearnCardProps) {
  const { block, document: doc, cardState, intervalPreviews } = card
  const direction = cardState.direction
  const navigate = useNavigate()
  const suspendCardMutation = useMutation(
    api.cardStates.suspendCard,
  ).withOptimisticUpdate((localStore, args) => {
    const session = localStore.getQuery(api.cardStates.getLearnSession, {})
    if (!session) return
    localStore.setQuery(
      api.cardStates.getLearnSession,
      {},
      session.filter((c) => c.cardState._id !== args.cardStateId),
    )
  })

  const handleEditCard = () => {
    if (!doc) {
      toast.error('Cannot edit: document not found')
      return
    }
    navigate({
      to: '/doc/$docId',
      params: { docId: doc._id },
    })
  }

  const handleSuspendCard = async () => {
    try {
      await suspendCardMutation({
        cardStateId: cardState._id,
        suspend: true,
      })
      toast.success('Card suspended')
    } catch (error) {
      toast.error('Failed to suspend card')
    }
  }

  // Normalize LearnCard to FlashcardBaseData
  const baseData: FlashcardBaseData = {
    documentTitle: doc?.title || 'Untitled',
    direction,
    cardType: block.cardType,
    cardFront: block.cardFront,
    cardBack: block.cardBack,
    textContent: block.textContent,
    ancestorPath: block.ancestorPath,
  }

  const renderHeaderBadges = () => (
    <Badge
      variant="outline"
      className={cn('text-xs', STATE_COLORS[cardState.state])}
    >
      {STATE_LABELS[cardState.state]}
    </Badge>
  )

  const renderActions = () => (
    <RatingButtons
      intervalPreviews={intervalPreviews}
      onRate={onRate}
      activeRating={activeRating}
    />
  )

  return (
    <FlashcardBase
      card={baseData}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
      renderHeaderBadges={renderHeaderBadges}
      renderActions={renderActions}
      isLeech={card.isLeech}
      leechReason={card.leechReason}
      onEditCard={handleEditCard}
      onSuspendCard={handleSuspendCard}
    />
  )
}
