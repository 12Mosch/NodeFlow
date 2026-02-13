import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { FlashcardBlockWithAncestorPath } from '../../../convex/helpers/flashcardContext'
import type { NextActiveExam } from '../../../convex/helpers/examDocuments'

export type LearnCardState = Doc<'cardStates'>
export type LearnBlock = FlashcardBlockWithAncestorPath

export interface LearnCard {
  cardState: LearnCardState
  block: LearnBlock
  document: {
    _id: Id<'documents'>
    title: string
  } | null
  retrievability: number
  examPriority: boolean
  priorityExam: NextActiveExam | null
  retrievabilityAtExam: number | null
  intervalPreviews: {
    again: string
    hard: string
    good: string
    easy: string
  }
  isLeech: boolean
  leechReason: string | null
  retention: number | null
}

export type Rating = 1 | 2 | 3 | 4

export function calculateSuccessRate(
  reviewedCount: number,
  againCount: number,
): number {
  return reviewedCount > 0
    ? ((reviewedCount - againCount) / reviewedCount) * 100
    : 100
}

export interface LearnSessionStats {
  totalCards: number
  newCards: number
  reviewCards: number
  dueNow: number
  reviewedToday: number
  retentionRate: number | null
}
