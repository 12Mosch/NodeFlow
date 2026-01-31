/**
 * Exam Scheduling Helpers
 *
 * Functions for calculating the retrievability period before an exam.
 * The retrievability period scales with the number of cards to ensure
 * all cards can be reviewed before the exam date.
 */

const BASE_PERIOD_DAYS = 3
const SCALE_FACTOR = 0.05 // 1 day per 20 cards
const MAX_PERIOD_DAYS = 30

/**
 * Calculate the retrievability period in days based on card count.
 *
 * Formula: periodDays = min(30, 3 + cardCount * 0.05)
 *
 * Examples:
 * - 20 cards = 4 days
 * - 100 cards = 8 days
 * - 500 cards = 28 days
 * - 1000+ cards = 30 days (cap)
 *
 * @param cardCount - Number of cards linked to the exam
 * @returns Period in days before exam when cards should be shown
 */
export function calculateRetrievabilityPeriodDays(cardCount: number): number {
  // Guard against negative cardCount from bugs elsewhere
  const safeCardCount = Math.max(0, cardCount)
  return Math.min(
    MAX_PERIOD_DAYS,
    Math.round(BASE_PERIOD_DAYS + safeCardCount * SCALE_FACTOR),
  )
}

/**
 * Check if the current time is within the retrievability period before an exam.
 *
 * @param examDate - Timestamp (ms) of the exam
 * @param cardCount - Number of cards linked to the exam
 * @param now - Current timestamp (defaults to Date.now())
 * @returns true if now is within the retrievability period (before exam date)
 */
export function isInRetrievabilityPeriod(
  examDate: number,
  cardCount: number,
  now: number = Date.now(),
): boolean {
  const periodDays = calculateRetrievabilityPeriodDays(cardCount)
  const periodStartMs = examDate - periodDays * 24 * 60 * 60 * 1000
  return now >= periodStartMs && now < examDate
}

/**
 * Get the start date of the retrievability period for an exam.
 *
 * @param examDate - Timestamp (ms) of the exam
 * @param cardCount - Number of cards linked to the exam
 * @returns Timestamp (ms) when the retrievability period starts
 */
export function getRetrievabilityPeriodStart(
  examDate: number,
  cardCount: number,
): number {
  const periodDays = calculateRetrievabilityPeriodDays(cardCount)
  return examDate - periodDays * 24 * 60 * 60 * 1000
}

/**
 * Get the number of days until an exam.
 *
 * @param examDate - Timestamp (ms) of the exam
 * @param now - Current timestamp (defaults to Date.now())
 * @returns Number of days until exam (can be negative if exam has passed)
 */
export function getDaysUntilExam(
  examDate: number,
  now: number = Date.now(),
): number {
  return Math.ceil((examDate - now) / (24 * 60 * 60 * 1000))
}

type CardDirection = 'forward' | 'reverse' | 'bidirectional' | 'disabled'

/**
 * Count the total number of reviewable cards from a list of blocks.
 * Bidirectional cards count as 2 (forward + reverse), disabled cards count as 0.
 *
 * @param blocks - Array of blocks with cardDirection property
 * @returns Total card count
 */
export function countCardsFromBlocks(
  blocks: Array<{ cardDirection?: CardDirection | null }>,
): number {
  let count = 0
  for (const block of blocks) {
    if (block.cardDirection === 'bidirectional') {
      count += 2
    } else if (block.cardDirection && block.cardDirection !== 'disabled') {
      count += 1
    }
  }
  return count
}
