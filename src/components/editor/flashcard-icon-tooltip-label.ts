import type { CardType } from '@/lib/flashcard-parser'

const FLASHCARD_TYPE_LABELS: Record<CardType, string> = {
  basic: 'Basic',
  concept: 'Concept',
  descriptor: 'Descriptor',
  cloze: 'Cloze',
}

export function getFlashcardIconTooltipLabel(
  type: CardType,
  disabled: boolean,
): string {
  const baseLabel = `${FLASHCARD_TYPE_LABELS[type]} flashcard`
  return disabled ? `${baseLabel} (disabled)` : baseLabel
}
