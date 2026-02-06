import type { Id } from '../../../convex/_generated/dataModel'
import type { FlashcardWithDocument, QuizCard } from './types'

export function expandCardsForQuiz(
  documents: Array<FlashcardWithDocument>,
  selectedDocIds: Set<Id<'documents'>>,
): Array<QuizCard> {
  const cards: Array<QuizCard> = []

  for (const docData of documents) {
    if (!selectedDocIds.has(docData.document._id)) continue

    for (const block of docData.flashcards) {
      if (block.cardType === 'cloze') {
        cards.push({
          block,
          documentTitle: docData.document.title || 'Untitled',
          direction: 'forward',
        })
        continue
      }

      if (
        block.cardDirection === 'forward' ||
        block.cardDirection === 'bidirectional'
      ) {
        cards.push({
          block,
          documentTitle: docData.document.title || 'Untitled',
          direction: 'forward',
        })
      }

      if (block.cardDirection === 'bidirectional') {
        cards.push({
          block,
          documentTitle: docData.document.title || 'Untitled',
          direction: 'reverse',
        })
      }

      if (block.cardDirection === 'reverse') {
        cards.push({
          block,
          documentTitle: docData.document.title || 'Untitled',
          direction: 'reverse',
        })
      }
    }
  }

  return cards
}

export function computeExpandedCardCount(
  documents: Array<FlashcardWithDocument>,
  selectedDocIds: Set<Id<'documents'>>,
): number {
  return expandCardsForQuiz(documents, selectedDocIds).length
}
