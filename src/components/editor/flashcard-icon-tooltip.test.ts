import { describe, expect, it } from 'vitest'
import { getFlashcardIconTooltipLabel } from './flashcard-icon-tooltip-label'

describe('getFlashcardIconTooltipLabel', () => {
  it('returns type label for active flashcards', () => {
    expect(getFlashcardIconTooltipLabel('basic', false)).toBe('Basic flashcard')
    expect(getFlashcardIconTooltipLabel('concept', false)).toBe(
      'Concept flashcard',
    )
    expect(getFlashcardIconTooltipLabel('descriptor', false)).toBe(
      'Descriptor flashcard',
    )
    expect(getFlashcardIconTooltipLabel('cloze', false)).toBe('Cloze flashcard')
  })

  it('includes disabled suffix when flashcard is disabled', () => {
    expect(getFlashcardIconTooltipLabel('basic', true)).toBe(
      'Basic flashcard (disabled)',
    )
    expect(getFlashcardIconTooltipLabel('cloze', true)).toBe(
      'Cloze flashcard (disabled)',
    )
  })
})
