import { Check, X } from 'lucide-react'
import { FlashcardBase } from './flashcard-base'
import type { FlashcardBaseData, QuizCard } from './types'
import { Button } from '@/components/ui/button'

interface FlashcardItemProps {
  card: QuizCard
  onAnswer: (knew: boolean) => void
  showButtons?: boolean
  isExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function FlashcardItem({
  card,
  onAnswer,
  showButtons = true,
  isExpanded,
  onExpandedChange,
}: FlashcardItemProps) {
  const { block, documentTitle, direction } = card

  // Normalize QuizCard to FlashcardBaseData
  const baseData: FlashcardBaseData = {
    documentTitle,
    direction,
    cardType: block.cardType,
    cardFront: block.cardFront,
    cardBack: block.cardBack,
    textContent: block.textContent,
  }

  const renderActions = () => {
    if (!showButtons) return null

    return (
      <div className="flex gap-4">
        <Button
          variant="outline"
          className="flex-1 gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
          onClick={() => onAnswer(false)}
        >
          <X className="h-4 w-4" />
          Didn&apos;t know
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
          onClick={() => onAnswer(true)}
        >
          <Check className="h-4 w-4" />
          Knew it
        </Button>
      </div>
    )
  }

  return (
    <FlashcardBase
      card={baseData}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
      renderActions={renderActions}
    />
  )
}
