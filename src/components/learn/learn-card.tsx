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

  // Normalize LearnCard to FlashcardBaseData
  const baseData: FlashcardBaseData = {
    documentTitle: doc?.title || 'Untitled',
    direction,
    cardType: block.cardType,
    cardFront: block.cardFront,
    cardBack: block.cardBack,
    textContent: block.textContent,
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
    />
  )
}
