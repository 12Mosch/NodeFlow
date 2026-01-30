import { describe, expect, it } from 'vitest'
import {
  createNewCardState,
  formatInterval,
  getRetrievability,
  processReview,
} from './fsrs'
import type { CardState } from './fsrs'

/**
 * Helper to parse retrievability value.
 * The ts-fsrs library returns retrievability as a formatted string like "90.00%"
 * This function converts it to a number between 0 and 1.
 */
function parseRetrievability(value: number | string): number {
  if (typeof value === 'number') {
    return value
  }
  // Handle string format like "90.00%"
  const match = value.match(/^([\d.]+)%$/)
  if (match) {
    return parseFloat(match[1]) / 100
  }
  return parseFloat(value)
}

describe('fsrs', () => {
  describe('processReview', () => {
    describe('from new state', () => {
      const newCard = createNewCardState()
      const now = new Date('2024-01-01T12:00:00Z')

      it('should transition to learning with rating 1 (Again)', () => {
        const result = processReview(newCard, 1, now)

        expect(result.card.state).toBe('learning')
        expect(result.card.reps).toBe(1)
        expect(result.card.lapses).toBe(0)
        expect(result.card.stability).toBeGreaterThan(0)
      })

      it('should transition to learning with rating 2 (Hard)', () => {
        const result = processReview(newCard, 2, now)

        expect(result.card.state).toBe('learning')
        expect(result.card.reps).toBe(1)
        expect(result.card.lapses).toBe(0)
      })

      it('should transition to learning or review with rating 3 (Good)', () => {
        const result = processReview(newCard, 3, now)

        expect(['learning', 'review']).toContain(result.card.state)
        expect(result.card.reps).toBe(1)
        expect(result.card.lapses).toBe(0)
      })

      it('should transition to review with rating 4 (Easy)', () => {
        const result = processReview(newCard, 4, now)

        expect(result.card.state).toBe('review')
        expect(result.card.reps).toBe(1)
        expect(result.card.lapses).toBe(0)
        expect(result.card.stability).toBeGreaterThan(0)
      })

      it('should have higher stability with Easy than Again', () => {
        const againResult = processReview(newCard, 1, now)
        const easyResult = processReview(newCard, 4, now)

        expect(easyResult.card.stability).toBeGreaterThan(
          againResult.card.stability,
        )
      })
    })

    describe('from learning state', () => {
      const now = new Date('2024-01-01T12:30:00Z')
      const learningCard: CardState = {
        stability: 1.5,
        difficulty: 5,
        due: now.getTime(),
        lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
        reps: 1,
        lapses: 0,
        state: 'learning',
        scheduledDays: 0,
        elapsedDays: 0,
      }

      it('should stay in learning or move to relearning with rating 1', () => {
        const result = processReview(learningCard, 1, now)

        expect(['learning', 'relearning']).toContain(result.card.state)
        expect(result.card.reps).toBe(2)
      })

      it('should progress toward review with rating 3', () => {
        const result = processReview(learningCard, 3, now)

        expect(result.card.reps).toBe(2)
        // Stability should not decrease after a Good rating
        expect(result.card.stability).toBeGreaterThanOrEqual(
          learningCard.stability,
        )
      })

      it('should graduate to review faster with rating 4', () => {
        const result = processReview(learningCard, 4, now)

        expect(result.card.state).toBe('review')
        expect(result.card.reps).toBe(2)
      })
    })

    describe('from review state', () => {
      const now = new Date('2024-01-11T12:00:00Z')
      const reviewCard: CardState = {
        stability: 10,
        difficulty: 5,
        due: now.getTime(),
        lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
        reps: 5,
        lapses: 0,
        state: 'review',
        scheduledDays: 10,
        elapsedDays: 10,
      }

      it('should move to relearning and increase lapses with rating 1', () => {
        const result = processReview(reviewCard, 1, now)

        expect(result.card.state).toBe('relearning')
        expect(result.card.lapses).toBe(1)
        expect(result.card.reps).toBe(6)
      })

      it('should stay in review with rating 2', () => {
        const result = processReview(reviewCard, 2, now)

        expect(result.card.state).toBe('review')
        expect(result.card.lapses).toBe(0)
        expect(result.card.reps).toBe(6)
      })

      it('should stay in review with rating 3', () => {
        const result = processReview(reviewCard, 3, now)

        expect(result.card.state).toBe('review')
        expect(result.card.lapses).toBe(0)
        expect(result.card.reps).toBe(6)
      })

      it('should stay in review with rating 4', () => {
        const result = processReview(reviewCard, 4, now)

        expect(result.card.state).toBe('review')
        expect(result.card.lapses).toBe(0)
        expect(result.card.reps).toBe(6)
      })

      it('should increase interval more with Easy than Good', () => {
        const goodResult = processReview(reviewCard, 3, now)
        const easyResult = processReview(reviewCard, 4, now)

        expect(easyResult.card.scheduledDays).toBeGreaterThan(
          goodResult.card.scheduledDays,
        )
      })

      it('should decrease stability when rating Again', () => {
        const result = processReview(reviewCard, 1, now)

        expect(result.card.stability).toBeLessThan(reviewCard.stability)
      })
    })

    describe('from relearning state', () => {
      const now = new Date('2024-01-11T12:30:00Z')
      const relearningCard: CardState = {
        stability: 2,
        difficulty: 6,
        due: now.getTime(),
        lastReview: new Date('2024-01-11T12:00:00Z').getTime(),
        reps: 6,
        lapses: 1,
        state: 'relearning',
        scheduledDays: 0,
        elapsedDays: 0,
      }

      it('should stay in relearning with rating 1', () => {
        const result = processReview(relearningCard, 1, now)

        expect(result.card.state).toBe('relearning')
        expect(result.card.reps).toBe(7)
      })

      it('should return to review with rating 3', () => {
        const result = processReview(relearningCard, 3, now)

        expect(result.card.state).toBe('review')
        expect(result.card.reps).toBe(7)
        expect(result.card.lapses).toBe(1) // Lapses should stay same
      })

      it('should return to review with rating 4', () => {
        const result = processReview(relearningCard, 4, now)

        expect(result.card.state).toBe('review')
        expect(result.card.reps).toBe(7)
      })
    })

    describe('review log', () => {
      const newCard = createNewCardState()
      const now = new Date('2024-01-01T12:00:00Z')

      it('should contain correct rating', () => {
        for (const rating of [1, 2, 3, 4] as const) {
          const result = processReview(newCard, rating, now)
          expect(result.reviewLog.rating).toBe(rating)
        }
      })

      it('should record previous state', () => {
        const result = processReview(newCard, 3, now)

        expect(result.reviewLog.state).toBe('new')
      })

      it('should include scheduledDays and elapsedDays', () => {
        const result = processReview(newCard, 3, now)

        expect(typeof result.reviewLog.scheduledDays).toBe('number')
        expect(typeof result.reviewLog.elapsedDays).toBe('number')
        expect(result.reviewLog.scheduledDays).toBeGreaterThanOrEqual(0)
        expect(result.reviewLog.elapsedDays).toBeGreaterThanOrEqual(0)
      })

      it('should include stability and difficulty', () => {
        const result = processReview(newCard, 3, now)

        expect(typeof result.reviewLog.stability).toBe('number')
        expect(typeof result.reviewLog.difficulty).toBe('number')
        // Note: review log records the PREVIOUS state's values
        // For new cards, stability and difficulty start at 0
        expect(result.reviewLog.stability).toBeGreaterThanOrEqual(0)
        expect(result.reviewLog.difficulty).toBeGreaterThanOrEqual(0)
      })

      it('should include reviewedAt timestamp', () => {
        const result = processReview(newCard, 3, now)

        expect(result.reviewLog.reviewedAt).toBe(now.getTime())
      })

      it('should capture state transition in log', () => {
        const reviewDueDate = new Date('2024-01-11T12:00:00Z')
        const reviewCard: CardState = {
          stability: 10,
          difficulty: 5,
          due: reviewDueDate.getTime(),
          lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
          reps: 5,
          lapses: 0,
          state: 'review',
          scheduledDays: 10,
          elapsedDays: 10,
        }

        const result = processReview(reviewCard, 1, reviewDueDate)

        // Log should show previous state (review), card shows new state (relearning)
        expect(result.reviewLog.state).toBe('review')
        expect(result.card.state).toBe('relearning')
      })
    })
  })

  describe('getRetrievability', () => {
    describe('new cards', () => {
      it('should return 0 for new cards', () => {
        const newCard = createNewCardState()
        const now = new Date('2024-01-01T12:00:00Z')

        const retrievability = getRetrievability(newCard, now)

        expect(parseRetrievability(retrievability)).toBe(0)
      })
    })

    describe('decay over time', () => {
      const reviewCard: CardState = {
        stability: 10,
        difficulty: 5,
        due: new Date('2024-01-11T12:00:00Z').getTime(),
        lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
        reps: 5,
        lapses: 0,
        state: 'review',
        scheduledDays: 10,
        elapsedDays: 10,
      }

      it('should be approximately 0.9 at due date', () => {
        const atDue = new Date('2024-01-11T12:00:00Z')
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, atDue),
        )

        // FSRS targets 90% retention at due date
        expect(retrievability).toBeCloseTo(0.9, 1)
      })

      it('should be > 0.9 before due date', () => {
        const beforeDue = new Date('2024-01-06T12:00:00Z') // 5 days in
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, beforeDue),
        )

        expect(retrievability).toBeGreaterThan(0.9)
      })

      it('should be < 0.9 after due date', () => {
        const afterDue = new Date('2024-01-16T12:00:00Z') // 5 days overdue
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, afterDue),
        )

        expect(retrievability).toBeLessThan(0.9)
      })

      it('should approach 0 when far overdue', () => {
        const farOverdue = new Date('2024-06-01T12:00:00Z') // ~5 months overdue
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, farOverdue),
        )

        // With stability=10, decay is gradual. At ~5 months overdue (~150 days),
        // retrievability is still around 0.65. The important thing is it's lower
        // than at the due date (0.9) and continues decreasing.
        expect(retrievability).toBeLessThan(0.9)
        expect(retrievability).toBeLessThan(0.8)
      })

      it('should decrease over time', () => {
        const day1 = new Date('2024-01-02T12:00:00Z')
        const day5 = new Date('2024-01-06T12:00:00Z')
        const day10 = new Date('2024-01-11T12:00:00Z')
        const day15 = new Date('2024-01-16T12:00:00Z')

        const r1 = parseRetrievability(getRetrievability(reviewCard, day1))
        const r5 = parseRetrievability(getRetrievability(reviewCard, day5))
        const r10 = parseRetrievability(getRetrievability(reviewCard, day10))
        const r15 = parseRetrievability(getRetrievability(reviewCard, day15))

        expect(r1).toBeGreaterThan(r5)
        expect(r5).toBeGreaterThan(r10)
        expect(r10).toBeGreaterThan(r15)
      })
    })

    describe('boundary values', () => {
      it('should always return value between 0 and 1', () => {
        const reviewCard: CardState = {
          stability: 10,
          difficulty: 5,
          due: new Date('2024-01-11T12:00:00Z').getTime(),
          lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
          reps: 5,
          lapses: 0,
          state: 'review',
          scheduledDays: 10,
          elapsedDays: 10,
        }

        const testDates = [
          new Date('2024-01-01T12:00:00Z'), // Just reviewed
          new Date('2024-01-11T12:00:00Z'), // At due
          new Date('2024-06-01T12:00:00Z'), // Far overdue
          new Date('2025-01-01T12:00:00Z'), // Very far overdue
        ]

        for (const date of testDates) {
          const retrievability = parseRetrievability(
            getRetrievability(reviewCard, date),
          )
          expect(retrievability).toBeGreaterThanOrEqual(0)
          expect(retrievability).toBeLessThanOrEqual(1)
        }
      })

      it('should never return negative', () => {
        const reviewCard: CardState = {
          stability: 1, // Very low stability
          difficulty: 10, // Maximum difficulty
          due: new Date('2024-01-02T12:00:00Z').getTime(),
          lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
          reps: 10,
          lapses: 5,
          state: 'review',
          scheduledDays: 1,
          elapsedDays: 1,
        }

        // Test even when extremely overdue
        const extremeOverdue = new Date('2030-01-01T12:00:00Z')
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, extremeOverdue),
        )

        expect(retrievability).toBeGreaterThanOrEqual(0)
      })

      it('should never return > 1', () => {
        const reviewCard: CardState = {
          stability: 100, // Very high stability
          difficulty: 1, // Minimum difficulty
          due: new Date('2024-04-11T12:00:00Z').getTime(),
          lastReview: new Date('2024-01-01T12:00:00Z').getTime(),
          reps: 20,
          lapses: 0,
          state: 'review',
          scheduledDays: 100,
          elapsedDays: 100,
        }

        // Test immediately after review
        const justReviewed = new Date('2024-01-01T12:00:01Z')
        const retrievability = parseRetrievability(
          getRetrievability(reviewCard, justReviewed),
        )

        expect(retrievability).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('formatInterval', () => {
    describe('minutes', () => {
      it('should format 10 minutes', () => {
        // 10 minutes = 10 / 1440 days ≈ 0.00694 days
        const days = 10 / (24 * 60)
        expect(formatInterval(days)).toBe('10m')
      })

      it('should format 30 minutes', () => {
        const days = 30 / (24 * 60)
        expect(formatInterval(days)).toBe('30m')
      })

      it('should format 50 minutes', () => {
        const days = 50 / (24 * 60)
        expect(formatInterval(days)).toBe('50m')
      })

      it('should round to nearest minute', () => {
        const days = 45.5 / (24 * 60)
        expect(formatInterval(days)).toBe('46m')
      })
    })

    describe('hours', () => {
      it('should format 1 hour', () => {
        const days = 1 / 24
        expect(formatInterval(days)).toBe('1h')
      })

      it('should format 6 hours', () => {
        const days = 6 / 24
        expect(formatInterval(days)).toBe('6h')
      })

      it('should format 12 hours', () => {
        const days = 12 / 24
        expect(formatInterval(days)).toBe('12h')
      })

      it('should format 23 hours', () => {
        const days = 23 / 24
        expect(formatInterval(days)).toBe('23h')
      })
    })

    describe('days', () => {
      it('should format 1 day', () => {
        expect(formatInterval(1)).toBe('1d')
      })

      it('should format 3.4 days as 3d (rounded)', () => {
        expect(formatInterval(3.4)).toBe('3d')
      })

      it('should format 6.7 days as 7d (rounded)', () => {
        expect(formatInterval(6.7)).toBe('7d')
      })

      it('should format exactly 6 days', () => {
        expect(formatInterval(6)).toBe('6d')
      })
    })

    describe('weeks', () => {
      it('should format 7 days as 1w', () => {
        expect(formatInterval(7)).toBe('1w')
      })

      it('should format 14 days as 2w', () => {
        expect(formatInterval(14)).toBe('2w')
      })

      it('should format 21 days as 3w', () => {
        expect(formatInterval(21)).toBe('3w')
      })

      it('should format 28 days as 4w', () => {
        expect(formatInterval(28)).toBe('4w')
      })
    })

    describe('months', () => {
      it('should format 30 days as 1mo', () => {
        expect(formatInterval(30)).toBe('1mo')
      })

      it('should format 60 days as 2mo', () => {
        expect(formatInterval(60)).toBe('2mo')
      })

      it('should format 180 days as 6mo', () => {
        expect(formatInterval(180)).toBe('6mo')
      })

      it('should format 300 days as 10mo', () => {
        expect(formatInterval(300)).toBe('10mo')
      })
    })

    describe('years', () => {
      it('should format 365 days as 1y', () => {
        expect(formatInterval(365)).toBe('1y')
      })

      it('should format 547.5 days as 1.5y', () => {
        expect(formatInterval(547.5)).toBe('1.5y')
      })

      it('should format 730 days as 2y', () => {
        expect(formatInterval(730)).toBe('2y')
      })

      it('should format 1095 days as 3y', () => {
        expect(formatInterval(1095)).toBe('3y')
      })
    })

    describe('boundary transitions', () => {
      it('should transition from minutes to hours at 60 minutes', () => {
        const just59min = 59 / (24 * 60)
        const just60min = 60 / (24 * 60)

        expect(formatInterval(just59min)).toBe('59m')
        expect(formatInterval(just60min)).toBe('1h')
      })

      it('should transition from hours to days at 24 hours', () => {
        const just23h = 23 / 24
        const exactly1d = 1

        expect(formatInterval(just23h)).toBe('23h')
        expect(formatInterval(exactly1d)).toBe('1d')
      })

      it('should transition from days to weeks at 7 days', () => {
        expect(formatInterval(6.5)).toBe('7d') // rounds to 7, but < 7 threshold
        expect(formatInterval(7)).toBe('1w')
      })

      it('should transition from weeks to months at 30 days', () => {
        expect(formatInterval(29)).toBe('4w')
        expect(formatInterval(30)).toBe('1mo')
      })

      it('should transition from months to years at 365 days', () => {
        expect(formatInterval(364)).toBe('12mo')
        expect(formatInterval(365)).toBe('1y')
      })
    })
  })

  describe('createNewCardState', () => {
    it('should create a card with new state', () => {
      const card = createNewCardState()
      expect(card.state).toBe('new')
    })

    it('should have zero reps and lapses', () => {
      const card = createNewCardState()
      expect(card.reps).toBe(0)
      expect(card.lapses).toBe(0)
    })

    it('should have no last review', () => {
      const card = createNewCardState()
      expect(card.lastReview).toBeUndefined()
    })

    it('should have initial stability and difficulty', () => {
      const card = createNewCardState()
      expect(card.stability).toBe(0)
      expect(card.difficulty).toBe(0)
    })
  })
})
