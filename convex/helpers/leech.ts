import type { QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

/**
 * Calculate retention rate for a card based on review history
 * Returns percentage (0-100) or null if insufficient data (< 5 reviews)
 */
export async function calculateRetention(
  ctx: QueryCtx,
  cardStateId: Id<'cardStates'>,
): Promise<number | null> {
  const reviewLogs = await ctx.db
    .query('reviewLogs')
    .withIndex('by_cardState', (q) => q.eq('cardStateId', cardStateId))
    .collect()

  // Need at least 5 reviews for meaningful retention rate
  if (reviewLogs.length < 5) {
    return null
  }

  // Count successful reviews (rating >= 3 = Good or Easy)
  const successfulReviews = reviewLogs.filter((log) => log.rating >= 3).length

  // Calculate percentage
  return Math.round((successfulReviews / reviewLogs.length) * 100)
}

/**
 * Determine if a card is a leech based on lapses and retention
 * Criteria: lapses > 5 OR (reps > 10 AND retention < 40%)
 */
export function isLeech(
  cardState: Doc<'cardStates'>,
  retention: number | null,
): boolean {
  // High lapse count indicates repeated failures
  if (cardState.lapses > 5) {
    return true
  }

  // Low retention rate after many reviews
  if (cardState.reps > 10 && retention !== null && retention < 40) {
    return true
  }

  return false
}

/**
 * Get human-readable explanation for why a card is a leech
 */
export function getLeechReason(
  cardState: Doc<'cardStates'>,
  retention: number | null,
): string {
  // Prioritize lapse count as primary indicator
  if (cardState.lapses > 5) {
    return `High lapse count (forgotten ${cardState.lapses} times)`
  }

  // Low retention rate
  if (cardState.reps > 10 && retention !== null && retention < 40) {
    return `Low retention (${retention}% after ${cardState.reps} reviews)`
  }

  // Fallback (shouldn't reach here if isLeech checks are consistent)
  return 'Multiple learning difficulties detected'
}
