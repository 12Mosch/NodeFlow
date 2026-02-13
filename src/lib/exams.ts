import type { Id } from '../../convex/_generated/dataModel'
import type { DocumentExamIndicator as SharedDocumentExamIndicator } from '../../shared/exam-indicators'

export const DAY_MS = 24 * 60 * 60 * 1000

export type DocumentExamIndicator = SharedDocumentExamIndicator

export interface DocumentExamIndicatorWithId extends DocumentExamIndicator {
  documentId: Id<'documents'>
}

export function formatExamCountdown(
  nextExamAt: number | null,
  now: number = Date.now(),
) {
  if (nextExamAt === null) return null
  if (nextExamAt < now) return 'Past due'
  const nowDate = new Date(now)
  const nextExamDate = new Date(nextExamAt)
  const daysUntil = Math.round(
    (Date.UTC(
      nextExamDate.getFullYear(),
      nextExamDate.getMonth(),
      nextExamDate.getDate(),
    ) -
      Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())) /
      DAY_MS,
  )
  if (daysUntil === 0) return 'Today'
  if (daysUntil === 1) return '1 day'
  return `${daysUntil} days`
}

export function formatExamDateTime(examAt: number) {
  // Locale/timezone output is environment-dependent; this helper is intended for client-rendered UI.
  return new Date(examAt).toLocaleString()
}

export function getDocumentExamIndicatorMap(
  indicators: Array<DocumentExamIndicatorWithId>,
) {
  // When duplicate documentIds are present, later entries intentionally win.
  return new Map(
    indicators.map((indicator) => [indicator.documentId, indicator]),
  )
}

export function mergeDocumentExamIndicatorPages(
  indicatorPages: Array<Array<DocumentExamIndicatorWithId>>,
) {
  return getDocumentExamIndicatorMap(indicatorPages.flat())
}
