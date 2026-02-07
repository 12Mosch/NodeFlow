import type { Id } from '../../../convex/_generated/dataModel'
import type { FlashcardBlockWithAncestorPath } from '../../../convex/helpers/flashcardContext'

export type FlashcardBlock = FlashcardBlockWithAncestorPath

export interface FlashcardWithDocument {
  document: {
    _id: Id<'documents'>
    title: string
  }
  flashcards: Array<FlashcardBlock>
}

export interface QuizCard {
  block: FlashcardBlock
  documentTitle: string
  // For bidirectional cards, we show both directions
  direction: 'forward' | 'reverse'
}

export interface QuizResult {
  card: QuizCard
  knew: boolean
}

export type QuizState = 'selecting' | 'studying' | 'results'

export interface FlashcardBaseData {
  documentTitle: string
  direction: 'forward' | 'reverse'
  cardType: 'basic' | 'concept' | 'descriptor' | 'cloze' | null | undefined
  cardFront: string | null | undefined
  cardBack: string | null | undefined
  textContent: string
  ancestorPath?: Array<string>
}
