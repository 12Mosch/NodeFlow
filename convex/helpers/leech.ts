import type { QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

/**
 * Calculate retention rate from an array of review logs.
 * Returns percentage (0-100) or null if insufficient data (< 5 reviews).
 */
export function calculateRetentionFromLogs(
  logs: Array<Doc<'reviewLogs'>>,
): number | null {
  if (logs.length < 5) {
    return null
  }

  const successfulReviews = logs.filter((log) => log.rating >= 3).length

  return Math.round((successfulReviews / logs.length) * 100)
}

/**
 * Fetch all review logs for a user in a single query and return a map
 * from cardStateId → retention percentage (or null).
 */
export async function fetchRetentionMap(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Map<string, number | null>> {
  const allLogs = await ctx.db
    .query('reviewLogs')
    .withIndex('by_user_date', (q) => q.eq('userId', userId))
    .collect()

  const grouped = new Map<string, Array<Doc<'reviewLogs'>>>()
  for (const log of allLogs) {
    const key = log.cardStateId
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(log)
    } else {
      grouped.set(key, [log])
    }
  }

  const retentionMap = new Map<string, number | null>()
  for (const [cardStateId, logs] of grouped) {
    retentionMap.set(cardStateId, calculateRetentionFromLogs(logs))
  }

  return retentionMap
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
