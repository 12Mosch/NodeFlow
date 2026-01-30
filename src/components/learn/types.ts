import type { Doc, Id } from '../../../convex/_generated/dataModel'

export type LearnCardState = Doc<'cardStates'>
export type LearnBlock = Doc<'blocks'>

export interface LearnCard {
  cardState: LearnCardState
  block: LearnBlock
  document: {
    _id: Id<'documents'>
    title: string
  } | null
  retrievability: number
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

export interface LearnSessionStats {
  totalCards: number
  newCards: number
  reviewCards: number
  dueNow: number
  reviewedToday: number
  retentionRate: number | null
}
