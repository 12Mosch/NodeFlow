import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  formatExamCountdown,
  mergeDocumentExamIndicatorPages,
} from './exams'
import type { Id } from '../../convex/_generated/dataModel'

describe('formatExamCountdown', () => {
  const now = new Date('2026-02-12T12:00:00.000Z').getTime()

  it('returns null when no exam timestamp is provided', () => {
    expect(formatExamCountdown(null, now)).toBeNull()
  })

  it('returns Today when exam is on the same day window', () => {
    expect(formatExamCountdown(now, now)).toBe('Today')
  })

  it('returns Today when exam is later the same day', () => {
    expect(formatExamCountdown(now + 1, now)).toBe('Today')
  })

  it('returns 1 day for the next day', () => {
    expect(formatExamCountdown(now + DAY_MS, now)).toBe('1 day')
  })

  it('returns N days for dates beyond tomorrow', () => {
    expect(formatExamCountdown(now + 3 * DAY_MS, now)).toBe('3 days')
  })

  it('returns Past due for past timestamps', () => {
    expect(formatExamCountdown(now - DAY_MS - 1, now)).toBe('Past due')
  })

  it('returns Past due for timestamps earlier today', () => {
    expect(formatExamCountdown(now - 1, now)).toBe('Past due')
  })

  it('returns 1 day across a near-midnight boundary', () => {
    const nearMidnight = new Date(2026, 1, 12, 23, 59, 59, 999).getTime()
    const nextMidnight = new Date(2026, 1, 13, 0, 0, 0, 0).getTime()
    expect(formatExamCountdown(nextMidnight, nearMidnight)).toBe('1 day')
  })
})

describe('mergeDocumentExamIndicatorPages', () => {
  it('merges indicator pages into a documentId keyed map', () => {
    const firstDocId = 'doc-1' as Id<'documents'>
    const secondDocId = 'doc-2' as Id<'documents'>

    const merged = mergeDocumentExamIndicatorPages([
      [
        {
          documentId: firstDocId,
          activeExamCount: 1,
          nextExamAt: 1_000,
          nextExamTitle: 'First Exam',
        },
      ],
      [
        {
          documentId: secondDocId,
          activeExamCount: 2,
          nextExamAt: 2_000,
          nextExamTitle: 'Second Exam',
        },
      ],
    ])

    expect(merged.size).toBe(2)
    expect(merged.get(firstDocId)?.activeExamCount).toBe(1)
    expect(merged.get(secondDocId)?.nextExamTitle).toBe('Second Exam')
  })

  it('uses the most recent indicator when the same document appears on multiple pages', () => {
    const sharedDocId = 'doc-1' as Id<'documents'>

    const merged = mergeDocumentExamIndicatorPages([
      [
        {
          documentId: sharedDocId,
          activeExamCount: 1,
          nextExamAt: 1_000,
          nextExamTitle: 'Older',
        },
      ],
      [
        {
          documentId: sharedDocId,
          activeExamCount: 3,
          nextExamAt: 3_000,
          nextExamTitle: 'Newer',
        },
      ],
    ])

    expect(merged.size).toBe(1)
    expect(merged.get(sharedDocId)?.activeExamCount).toBe(3)
    expect(merged.get(sharedDocId)?.nextExamTitle).toBe('Newer')
  })
})
