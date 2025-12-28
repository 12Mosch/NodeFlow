import type { Doc, Id } from '../../../convex/_generated/dataModel'

export type FlashcardBlock = Doc<'blocks'>

export interface FlashcardWithDocument {
  document: {
    _id: Id<'documents'>
    title: string
  }
  flashcards: Array<FlashcardBlock>
  count: number
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
