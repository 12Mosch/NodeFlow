import * as Sentry from '@sentry/tanstackstart-react'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUser, requireUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'
import {
  createNewCardState,
  formatInterval,
  getRetrievability,
  previewIntervals,
  processReview,
} from './helpers/fsrs'
import {
  buildAncestorPathByNodeId,
  getCachedAncestorPathFromAttrs,
} from './helpers/flashcardContext'
import { fetchRetentionMap, getLeechReason, isLeech } from './helpers/leech'
import type { CardState } from './helpers/fsrs'
import type { Id } from './_generated/dataModel'

const DAY_MS = 24 * 60 * 60 * 1000

const difficultyBuckets = [
  { label: '1-2', min: 1, max: 2 },
  { label: '3-4', min: 3, max: 4 },
  { label: '5-6', min: 5, max: 6 },
  { label: '7-8', min: 7, max: 8 },
  { label: '9-10', min: 9, max: 10 },
]

const intervalBuckets = [
  { label: '0-1d', min: 0, max: 1 },
  { label: '2-3d', min: 2, max: 3 },
  { label: '4-7d', min: 4, max: 7 },
  { label: '8-14d', min: 8, max: 14 },
  { label: '15-30d', min: 15, max: 30 },
  { label: '31-60d', min: 31, max: 60 },
  { label: '61-120d', min: 61, max: 120 },
  { label: '121d+', min: 121, max: Number.POSITIVE_INFINITY },
]

function startOfDayUtc(timestamp: number) {
  const date = new Date(timestamp)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

function toRate(correct: number, total: number) {
  if (total <= 0) return null
  return Math.round((correct / total) * 1000) / 10
}

// Direction validator
const directionValidator = v.union(v.literal('forward'), v.literal('reverse'))

const cardStateStatusValidator = v.union(
  v.literal('new'),
  v.literal('learning'),
  v.literal('review'),
  v.literal('relearning'),
)

const cardStateSnapshotValidator = v.object({
  stability: v.number(),
  difficulty: v.number(),
  due: v.number(),
  lastReview: v.optional(v.number()),
  reps: v.number(),
  lapses: v.number(),
  state: cardStateStatusValidator,
  scheduledDays: v.number(),
  elapsedDays: v.number(),
})

function normalizeTextContent(textContent: string): string | null {
  const trimmed = textContent.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getOutlineAncestorNodeIds(attrs: unknown): Array<string> | null {
  if (!attrs || typeof attrs !== 'object') {
    return null
  }

  const value = (attrs as Record<string, unknown>).outlineAncestorNodeIds
  if (!Array.isArray(value)) {
    return null
  }

  const seen = new Set<string>()
  const nodeIds: Array<string> = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const nodeId = item.trim()
    if (!nodeId || seen.has(nodeId)) continue
    seen.add(nodeId)
    nodeIds.push(nodeId)
  }

  return nodeIds
}

/**
 * Get or create card state for a block+direction combination
 */
export const getOrCreateCardState = mutation({
  args: {
    blockId: v.id('blocks'),
    direction: directionValidator,
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getOrCreateCardState', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Fetch the block and verify ownership
        const block = await ctx.db.get(args.blockId)
        if (!block) {
          throw new Error('Block not found')
        }
        if (block.userId !== userId) {
          throw new Error('Not authorized to create card state for this block')
        }

        // Check if card state already exists
        const existing = await ctx.db
          .query('cardStates')
          .withIndex('by_block_direction', (q) =>
            q.eq('blockId', args.blockId).eq('direction', args.direction),
          )
          .unique()

        if (existing) {
          return existing._id
        }

        // Create new card state with FSRS defaults
        const newState = createNewCardState()

        const id = await ctx.db.insert('cardStates', {
          blockId: args.blockId,
          userId,
          direction: args.direction,
          stability: newState.stability,
          difficulty: newState.difficulty,
          due: newState.due,
          lastReview: newState.lastReview,
          reps: newState.reps,
          lapses: newState.lapses,
          state: newState.state,
          scheduledDays: newState.scheduledDays,
          elapsedDays: newState.elapsedDays,
          suspended: false,
        })

        return id
      },
    )
  },
})

/**
 * Ensure card states exist for all directions of a block
 */
export const ensureCardStates = mutation({
  args: {
    blockId: v.id('blocks'),
    directions: v.array(directionValidator),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.ensureCardStates', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Fetch the block and verify ownership
        const block = await ctx.db.get(args.blockId)
        if (!block) {
          throw new Error('Block not found')
        }
        if (block.userId !== userId) {
          throw new Error('Not authorized to create card state for this block')
        }

        const results: Array<Id<'cardStates'>> = []

        for (const direction of args.directions) {
          // Check if card state already exists
          const existing = await ctx.db
            .query('cardStates')
            .withIndex('by_block_direction', (q) =>
              q.eq('blockId', args.blockId).eq('direction', direction),
            )
            .unique()

          if (existing) {
            results.push(existing._id)
            continue
          }

          // Create new card state with FSRS defaults
          const newState = createNewCardState()

          const id = await ctx.db.insert('cardStates', {
            blockId: args.blockId,
            userId,
            direction,
            stability: newState.stability,
            difficulty: newState.difficulty,
            due: newState.due,
            lastReview: newState.lastReview,
            reps: newState.reps,
            lapses: newState.lapses,
            state: newState.state,
            scheduledDays: newState.scheduledDays,
            elapsedDays: newState.elapsedDays,
            suspended: false,
          })

          results.push(id)
        }

        return results
      },
    )
  },
})

/**
 * Process a review for a card
 */
export const reviewCard = mutation({
  args: {
    cardStateId: v.id('cardStates'),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.reviewCard', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Get the card state
        const cardState = await ctx.db.get(args.cardStateId)
        if (!cardState) {
          throw new Error('Card state not found')
        }

        // Verify ownership
        if (cardState.userId !== userId) {
          throw new Error('Not authorized to review this card')
        }

        // Convert to FSRS CardState format
        const currentState: CardState = {
          stability: cardState.stability,
          difficulty: cardState.difficulty,
          due: cardState.due,
          lastReview: cardState.lastReview,
          reps: cardState.reps,
          lapses: cardState.lapses,
          state: cardState.state,
          scheduledDays: cardState.scheduledDays,
          elapsedDays: cardState.elapsedDays,
        }

        // Process the review
        const result = processReview(currentState, args.rating)

        // Update the card state
        await ctx.db.patch(args.cardStateId, {
          stability: result.card.stability,
          difficulty: result.card.difficulty,
          due: result.card.due,
          lastReview: result.card.lastReview,
          reps: result.card.reps,
          lapses: result.card.lapses,
          state: result.card.state,
          scheduledDays: result.card.scheduledDays,
          elapsedDays: result.card.elapsedDays,
        })

        // Create review log
        const reviewLogId = await ctx.db.insert('reviewLogs', {
          cardStateId: args.cardStateId,
          userId,
          rating: args.rating,
          state: result.reviewLog.state,
          scheduledDays: result.reviewLog.scheduledDays,
          elapsedDays: result.reviewLog.elapsedDays,
          stability: result.reviewLog.stability,
          difficulty: result.reviewLog.difficulty,
          reviewedAt: result.reviewLog.reviewedAt,
        })

        return {
          nextDue: result.card.due,
          scheduledDays: result.card.scheduledDays,
          state: result.card.state,
          reviewLogId,
        }
      },
    )
  },
})

/**
 * Undo the most recent review for a card (client-provided snapshot)
 */
export const undoReview = mutation({
  args: {
    cardStateId: v.id('cardStates'),
    previousState: cardStateSnapshotValidator,
    reviewLogId: v.optional(v.id('reviewLogs')),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.undoReview', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const cardState = await ctx.db.get(args.cardStateId)
        if (!cardState) {
          throw new Error('Card state not found')
        }

        if (cardState.userId !== userId) {
          throw new Error('Not authorized to undo this review')
        }

        let reviewLog = null
        if (args.reviewLogId) {
          reviewLog = await ctx.db.get(args.reviewLogId)
          if (!reviewLog) {
            throw new Error('Review log not found')
          }
          if (reviewLog.userId !== userId) {
            throw new Error('Not authorized to delete this review log')
          }
          if (reviewLog.cardStateId !== args.cardStateId) {
            throw new Error('Review log does not match card state')
          }
          const latestLog = await ctx.db
            .query('reviewLogs')
            .withIndex('by_cardState', (q) =>
              q.eq('cardStateId', args.cardStateId),
            )
            .order('desc')
            .first()
          if (!latestLog || latestLog._id !== args.reviewLogId) {
            throw new Error('Review log does not match latest review')
          }
        }

        await ctx.db.patch(args.cardStateId, args.previousState)

        if (args.reviewLogId) {
          await ctx.db.delete(args.reviewLogId)
        }

        return { ok: true }
      },
    )
  },
})

/**
 * Get cards due for review
 */
export const getDueCards = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getDueCards', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null
        const now = Date.now()
        const limit = args.limit ?? 50

        // Get due card states for the user, excluding suspended, limited at DB level
        const dueCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due_suspended', (q) =>
            q.eq('userId', userId).eq('suspended', false).lte('due', now),
          )
          .take(limit)

        // Fetch the associated blocks
        const cardsWithBlocks = await Promise.all(
          dueCards.map(async (cardState) => {
            const block = await ctx.db.get(cardState.blockId)
            if (!block || !block.isCard || block.cardDirection === 'disabled') {
              return null
            }

            // Get document for title
            const document = await ctx.db.get(block.documentId)

            // Calculate retrievability
            const state: CardState = {
              stability: cardState.stability,
              difficulty: cardState.difficulty,
              due: cardState.due,
              lastReview: cardState.lastReview,
              reps: cardState.reps,
              lapses: cardState.lapses,
              state: cardState.state,
              scheduledDays: cardState.scheduledDays,
              elapsedDays: cardState.elapsedDays,
            }
            const retrievability = getRetrievability(state)

            // Get interval previews
            const intervals = previewIntervals(state)

            return {
              cardState,
              block,
              document: document
                ? { _id: document._id, title: document.title }
                : null,
              retrievability,
              intervalPreviews: {
                again: formatInterval(intervals.again),
                hard: formatInterval(intervals.hard),
                good: formatInterval(intervals.good),
                easy: formatInterval(intervals.easy),
              },
            }
          }),
        )

        // Filter out nulls (deleted blocks) and sort by retrievability (lowest first)
        return cardsWithBlocks
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .sort((a, b) => a.retrievability - b.retrievability)
      },
    )
  },
})

/**
 * Get new cards (never reviewed)
 */
export const getNewCards = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getNewCards', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null
        const limit = args.limit ?? 20

        // Get new cards, excluding suspended, limited at DB level
        const newCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_state_suspended', (q) =>
            q.eq('userId', userId).eq('state', 'new').eq('suspended', false),
          )
          .take(limit)

        // Fetch the associated blocks
        const cardsWithBlocks = await Promise.all(
          newCards.map(async (cardState) => {
            const block = await ctx.db.get(cardState.blockId)
            if (!block || !block.isCard || block.cardDirection === 'disabled') {
              return null
            }

            // Get document for title
            const document = await ctx.db.get(block.documentId)

            // Get interval previews for new cards
            const state: CardState = {
              stability: cardState.stability,
              difficulty: cardState.difficulty,
              due: cardState.due,
              lastReview: cardState.lastReview,
              reps: cardState.reps,
              lapses: cardState.lapses,
              state: cardState.state,
              scheduledDays: cardState.scheduledDays,
              elapsedDays: cardState.elapsedDays,
            }
            const intervals = previewIntervals(state)

            return {
              cardState,
              block,
              document: document
                ? { _id: document._id, title: document.title }
                : null,
              retrievability: 0,
              intervalPreviews: {
                again: formatInterval(intervals.again),
                hard: formatInterval(intervals.hard),
                good: formatInterval(intervals.good),
                easy: formatInterval(intervals.easy),
              },
            }
          }),
        )

        return cardsWithBlocks.filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )
      },
    )
  },
})

/**
 * Get learning statistics for the user
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getStats', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null
        const now = Date.now()
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // Get all card states for the user
        const allCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due', (q) => q.eq('userId', userId))
          .collect()

        // Count by state
        let newCount = 0
        let learningCount = 0
        let reviewCount = 0
        let dueCount = 0

        for (const card of allCards) {
          switch (card.state) {
            case 'new':
              newCount++
              break
            case 'learning':
            case 'relearning':
              learningCount++
              if (card.due <= now) dueCount++
              break
            case 'review':
              reviewCount++
              if (card.due <= now) dueCount++
              break
          }
        }

        // Get today's reviews
        const todayReviews = await ctx.db
          .query('reviewLogs')
          .withIndex('by_user_date', (q) =>
            q.eq('userId', userId).gte('reviewedAt', todayStart.getTime()),
          )
          .collect()

        // Calculate retention rate from today's reviews
        const correctReviews = todayReviews.filter((r) => r.rating >= 3).length
        const retentionRate =
          todayReviews.length > 0
            ? Math.round((correctReviews / todayReviews.length) * 100)
            : null

        return {
          totalCards: allCards.length,
          newCards: newCount,
          learningCards: learningCount,
          reviewCards: reviewCount,
          dueNow: dueCount,
          reviewedToday: todayReviews.length,
          retentionRate,
        }
      },
    )
  },
})

/**
 * Get cards for learning session (due + new cards mixed)
 */
export const getLearnSession = query({
  args: {
    newLimit: v.optional(v.number()),
    reviewLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getLearnSession', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null
        const now = Date.now()
        const newLimit = args.newLimit ?? 20
        const reviewLimit = args.reviewLimit ?? 100

        // Get due review cards (including learning/relearning), excluding suspended, limited at DB level
        const dueCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due_suspended', (q) =>
            q.eq('userId', userId).eq('suspended', false).lte('due', now),
          )
          .take(reviewLimit)

        // Get new cards, excluding suspended, limited at DB level
        const newCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_state_suspended', (q) =>
            q.eq('userId', userId).eq('state', 'new').eq('suspended', false),
          )
          .take(newLimit)

        // Collect IDs of due cards to avoid duplicates
        // (new cards can have due=now and match both queries)
        const dueCardIds = new Set(dueCards.map((card) => card._id))
        const filteredNewCards = newCards.filter(
          (card) => !dueCardIds.has(card._id),
        )

        // Combine and fetch cards
        const allCardStates = [...dueCards, ...filteredNewCards]

        // Fetch retention and block/document data in batches
        const uniqueBlockIds = Array.from(
          new Set(allCardStates.map((card) => card.blockId)),
        )
        const [retentionMap, blocks] = await Promise.all([
          fetchRetentionMap(ctx, userId),
          Promise.all(uniqueBlockIds.map((blockId) => ctx.db.get(blockId))),
        ])

        const enabledBlockById = new Map(
          blocks
            .filter(
              (block): block is NonNullable<typeof block> =>
                block !== null &&
                block.isCard === true &&
                block.cardDirection !== 'disabled',
            )
            .map((block) => [block._id, block]),
        )
        const ancestorPathByBlockId = new Map<Id<'blocks'>, Array<string>>()
        const outlineAncestorNodeIdsByBlockId = new Map<
          Id<'blocks'>,
          Array<string>
        >()
        const ancestorNodeIdsByDocumentId = new Map<
          Id<'documents'>,
          Set<string>
        >()

        for (const block of enabledBlockById.values()) {
          const outlineAncestorNodeIds = getOutlineAncestorNodeIds(block.attrs)
          if (outlineAncestorNodeIds && outlineAncestorNodeIds.length > 0) {
            outlineAncestorNodeIdsByBlockId.set(
              block._id,
              outlineAncestorNodeIds,
            )
            let ancestorNodeIds = ancestorNodeIdsByDocumentId.get(
              block.documentId,
            )
            if (!ancestorNodeIds) {
              ancestorNodeIds = new Set<string>()
              ancestorNodeIdsByDocumentId.set(block.documentId, ancestorNodeIds)
            }

            for (const nodeId of outlineAncestorNodeIds) {
              ancestorNodeIds.add(nodeId)
            }
            continue
          }

          const cachedAncestorPath = getCachedAncestorPathFromAttrs(block.attrs)
          if (cachedAncestorPath && cachedAncestorPath.length > 0) {
            ancestorPathByBlockId.set(block._id, cachedAncestorPath)
          }
        }

        const ancestorTextByDocumentAndNodeId = new Map<string, string>()
        const getAncestorLookupKey = (
          documentId: Id<'documents'>,
          nodeId: string,
        ) => `${documentId}:${nodeId}`

        await Promise.all(
          Array.from(ancestorNodeIdsByDocumentId.entries()).flatMap(
            ([documentId, ancestorNodeIds]) =>
              Array.from(ancestorNodeIds).map(async (nodeId) => {
                const ancestorBlock = await ctx.db
                  .query('blocks')
                  .withIndex('by_nodeId', (q) =>
                    q.eq('documentId', documentId).eq('nodeId', nodeId),
                  )
                  .unique()

                if (!ancestorBlock) return
                const normalizedText = normalizeTextContent(
                  ancestorBlock.textContent,
                )
                if (!normalizedText) return
                ancestorTextByDocumentAndNodeId.set(
                  getAncestorLookupKey(documentId, nodeId),
                  normalizedText,
                )
              }),
          ),
        )

        for (const [
          blockId,
          outlineAncestorNodeIds,
        ] of outlineAncestorNodeIdsByBlockId) {
          const block = enabledBlockById.get(blockId)
          if (!block) continue
          const resolvedPath = outlineAncestorNodeIds
            .map((nodeId) =>
              ancestorTextByDocumentAndNodeId.get(
                getAncestorLookupKey(block.documentId, nodeId),
              ),
            )
            .filter((text): text is string => Boolean(text))

          if (resolvedPath.length > 0) {
            ancestorPathByBlockId.set(block._id, resolvedPath)
          }
        }

        const uniqueDocumentIds = Array.from(
          new Set(
            Array.from(enabledBlockById.values()).map(
              (block) => block.documentId,
            ),
          ),
        )
        const documents = await Promise.all(
          uniqueDocumentIds.map((documentId) => ctx.db.get(documentId)),
        )
        const documentById = new Map(
          uniqueDocumentIds.map((documentId, index) => [
            documentId,
            documents[index],
          ]),
        )

        const cardsWithBlocks = allCardStates.map((cardState) => {
          const block = enabledBlockById.get(cardState.blockId)
          if (!block) {
            return null
          }

          // Get document for title
          const document = documentById.get(block.documentId)
          const ancestorPath = ancestorPathByBlockId.get(block._id)

          // Calculate retrievability and intervals
          const state: CardState = {
            stability: cardState.stability,
            difficulty: cardState.difficulty,
            due: cardState.due,
            lastReview: cardState.lastReview,
            reps: cardState.reps,
            lapses: cardState.lapses,
            state: cardState.state,
            scheduledDays: cardState.scheduledDays,
            elapsedDays: cardState.elapsedDays,
          }
          const retrievability = getRetrievability(state)
          const intervals = previewIntervals(state)

          // Calculate leech status
          const retention = retentionMap.get(cardState._id) ?? null
          const isLeechCard = isLeech(cardState, retention)
          const leechReason = isLeechCard
            ? getLeechReason(cardState, retention)
            : null

          return {
            cardState,
            block: {
              ...block,
              ancestorPath,
            },
            document: document
              ? { _id: document._id, title: document.title }
              : null,
            retrievability,
            intervalPreviews: {
              again: formatInterval(intervals.again),
              hard: formatInterval(intervals.hard),
              good: formatInterval(intervals.good),
              easy: formatInterval(intervals.easy),
            },
            isLeech: isLeechCard,
            leechReason,
            retention,
          }
        })

        // Filter out nulls and sort: due cards by retrievability, then new cards
        const validCards = cardsWithBlocks.filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )

        // Separate due and new cards
        const due = validCards
          .filter((c) => c.cardState.state !== 'new')
          .sort((a, b) => a.retrievability - b.retrievability)

        const newOnes = validCards.filter((c) => c.cardState.state === 'new')

        // Interleave: show due cards first, then introduce new ones
        return [...due, ...newOnes]
      },
    )
  },
})

/**
 * Get cards for learning session for a specific document (due + new cards mixed)
 */
export const getDocumentLearnSession = query({
  args: {
    documentId: v.id('documents'),
    newLimit: v.optional(v.number()),
    reviewLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getDocumentLearnSession', op: 'convex.query' },
      async () => {
        // Return null before auth is established (e.g. during cache restoration).
        // Uses getUser + requireDocumentAccess (not queryDocumentAccess) because
        // this query requires ownership — public access is not allowed.
        const authedUserId = await getUser(ctx)
        if (!authedUserId) return null
        const { userId } = await requireDocumentAccess(ctx, args.documentId)
        const now = Date.now()
        const newLimit = args.newLimit ?? 20
        const reviewLimit = args.reviewLimit ?? 100

        const documentBlocks = await ctx.db
          .query('blocks')
          .withIndex('by_document_isCard', (q) =>
            q.eq('documentId', args.documentId).eq('isCard', true),
          )
          .collect()

        // Filter out disabled cards
        const enabledBlocks = documentBlocks.filter(
          (block) => block.cardDirection !== 'disabled',
        )
        const enabledBlockById = new Map(
          enabledBlocks.map((block) => [block._id, block]),
        )
        const metadataAncestorPathByNodeId = new Map<string, Array<string>>()
        const outlineAncestorNodeIdsByBlockNodeId = new Map<
          string,
          Array<string>
        >()
        const ancestorNodeIds = new Set<string>()

        for (const block of enabledBlocks) {
          const outlineAncestorNodeIds = getOutlineAncestorNodeIds(block.attrs)
          if (outlineAncestorNodeIds && outlineAncestorNodeIds.length > 0) {
            outlineAncestorNodeIdsByBlockNodeId.set(
              block.nodeId,
              outlineAncestorNodeIds,
            )

            for (const nodeId of outlineAncestorNodeIds) {
              ancestorNodeIds.add(nodeId)
            }
            continue
          }

          const cachedAncestorPath = getCachedAncestorPathFromAttrs(block.attrs)
          if (cachedAncestorPath && cachedAncestorPath.length > 0) {
            metadataAncestorPathByNodeId.set(block.nodeId, cachedAncestorPath)
          }
        }

        const ancestorTextByNodeId = new Map<string, string>()

        await Promise.all(
          Array.from(ancestorNodeIds).map(async (nodeId) => {
            const ancestorBlock = await ctx.db
              .query('blocks')
              .withIndex('by_nodeId', (q) =>
                q.eq('documentId', args.documentId).eq('nodeId', nodeId),
              )
              .unique()

            if (!ancestorBlock) return
            const normalizedText = normalizeTextContent(
              ancestorBlock.textContent,
            )
            if (!normalizedText) return
            ancestorTextByNodeId.set(nodeId, normalizedText)
          }),
        )

        for (const [
          blockNodeId,
          outlineAncestorNodeIds,
        ] of outlineAncestorNodeIdsByBlockNodeId) {
          const resolvedPath = outlineAncestorNodeIds
            .map((nodeId) => ancestorTextByNodeId.get(nodeId))
            .filter((text): text is string => Boolean(text))

          if (resolvedPath.length > 0) {
            metadataAncestorPathByNodeId.set(blockNodeId, resolvedPath)
          }
        }

        const needsStructuralFallback = enabledBlocks.some(
          (block) => !metadataAncestorPathByNodeId.has(block.nodeId),
        )

        const ancestorPathByNodeId = needsStructuralFallback
          ? new Map([
              ...buildAncestorPathByNodeId(
                await ctx.db
                  .query('blocks')
                  .withIndex('by_document_position', (q) =>
                    q.eq('documentId', args.documentId),
                  )
                  .order('asc')
                  .collect(),
              ),
              ...metadataAncestorPathByNodeId,
            ])
          : metadataAncestorPathByNodeId

        const document = await ctx.db.get(args.documentId)

        const blockIds = Array.from(enabledBlocks.map((b) => b._id))

        // Query cardStates for each block in parallel using the by_block_direction index
        // This is more efficient than fetching all user cards globally and filtering
        const allCardStatesForBlocks = await Promise.all(
          blockIds.map(async (blockId) => {
            // Query all cardStates for this block (both directions)
            return await ctx.db
              .query('cardStates')
              .withIndex('by_block_direction', (q) => q.eq('blockId', blockId))
              .collect()
          }),
        )

        // Flatten and filter by userId (security check), suspended status, and due/state
        const allRelevantCards = allCardStatesForBlocks
          .flat()
          .filter((card) => card.userId === userId && card.suspended !== true)

        // Separate due and new cards
        const dueCards = allRelevantCards
          .filter((card) => card.state !== 'new' && card.due <= now)
          .sort((a, b) => a.due - b.due) // Sort by due date for consistent ordering
          .slice(0, reviewLimit)

        // Get new cards, excluding any that are already in dueCards
        const dueCardIds = new Set(dueCards.map((card) => card._id))
        const newCards = allRelevantCards
          .filter((card) => card.state === 'new' && !dueCardIds.has(card._id))
          .slice(0, newLimit)

        // Combine and fetch blocks
        const allCardStates = [...dueCards, ...newCards]

        // Batch-fetch all retention rates in one query
        const retentionMap = await fetchRetentionMap(ctx, userId)

        const cardsWithBlocks = allCardStates.map((cardState) => {
          const block = enabledBlockById.get(cardState.blockId)
          if (!block) {
            return null
          }
          const ancestorPath = ancestorPathByNodeId.get(block.nodeId)

          // Calculate retrievability and intervals
          const state: CardState = {
            stability: cardState.stability,
            difficulty: cardState.difficulty,
            due: cardState.due,
            lastReview: cardState.lastReview,
            reps: cardState.reps,
            lapses: cardState.lapses,
            state: cardState.state,
            scheduledDays: cardState.scheduledDays,
            elapsedDays: cardState.elapsedDays,
          }
          const retrievability = getRetrievability(state)
          const intervals = previewIntervals(state)

          // Calculate leech status
          const retention = retentionMap.get(cardState._id) ?? null
          const isLeechCard = isLeech(cardState, retention)
          const leechReason = isLeechCard
            ? getLeechReason(cardState, retention)
            : null

          return {
            cardState,
            block: {
              ...block,
              ancestorPath,
            },
            document: document
              ? { _id: document._id, title: document.title }
              : null,
            retrievability,
            intervalPreviews: {
              again: formatInterval(intervals.again),
              hard: formatInterval(intervals.hard),
              good: formatInterval(intervals.good),
              easy: formatInterval(intervals.easy),
            },
            isLeech: isLeechCard,
            leechReason,
            retention,
          }
        })

        // Filter out nulls and sort: due cards by retrievability, then new cards
        const validCards = cardsWithBlocks.filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )

        // Separate due and new cards
        const due = validCards
          .filter((c) => c.cardState.state !== 'new')
          .sort((a, b) => a.retrievability - b.retrievability)

        const newOnes = validCards.filter((c) => c.cardState.state === 'new')

        // Interleave: show due cards first, then introduce new ones
        return [...due, ...newOnes]
      },
    )
  },
})

/**
 * Initialize card states for all flashcards in a document
 * This is called when a user first starts spaced repetition for a document
 */
export const initializeDocumentCardStates = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      {
        name: 'cardStates.initializeDocumentCardStates',
        op: 'convex.mutation',
      },
      async () => {
        const userId = await requireUser(ctx)

        // Get all flashcards for this document
        const blocks = await ctx.db
          .query('blocks')
          .withIndex('by_document_isCard', (q) =>
            q.eq('documentId', args.documentId).eq('isCard', true),
          )
          .collect()

        // Filter out disabled cards
        const enabledBlocks = blocks.filter(
          (block) => block.cardDirection !== 'disabled',
        )

        let createdCount = 0

        for (const block of enabledBlocks) {
          // Verify ownership
          if (block.userId !== userId) {
            continue
          }

          // Determine which directions need card states
          const directions: Array<'forward' | 'reverse'> = []

          if (block.cardType === 'cloze') {
            // Cloze cards only have forward direction
            directions.push('forward')
          } else if (block.cardDirection === 'forward') {
            directions.push('forward')
          } else if (block.cardDirection === 'reverse') {
            directions.push('reverse')
          } else if (block.cardDirection === 'bidirectional') {
            directions.push('forward', 'reverse')
          }

          // Create card states for each direction if they don't exist
          for (const direction of directions) {
            const existing = await ctx.db
              .query('cardStates')
              .withIndex('by_block_direction', (q) =>
                q.eq('blockId', block._id).eq('direction', direction),
              )
              .unique()

            if (!existing) {
              const newState = createNewCardState()
              await ctx.db.insert('cardStates', {
                blockId: block._id,
                userId,
                direction,
                stability: newState.stability,
                difficulty: newState.difficulty,
                due: newState.due,
                lastReview: newState.lastReview,
                reps: newState.reps,
                lapses: newState.lapses,
                state: newState.state,
                scheduledDays: newState.scheduledDays,
                elapsedDays: newState.elapsedDays,
                suspended: false,
              })
              createdCount++
            }
          }
        }

        return { createdCount }
      },
    )
  },
})

/**
 * Suspend or unsuspend a card
 */
export const suspendCard = mutation({
  args: {
    cardStateId: v.id('cardStates'),
    suspend: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.suspendCard', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Get the card state
        const cardState = await ctx.db.get(args.cardStateId)
        if (!cardState) {
          throw new Error('Card state not found')
        }

        // Verify ownership
        if (cardState.userId !== userId) {
          throw new Error('Not authorized to suspend this card')
        }

        // Update suspension status
        await ctx.db.patch(args.cardStateId, {
          suspended: args.suspend,
          suspendedAt: args.suspend ? Date.now() : undefined,
        })

        return { success: true }
      },
    )
  },
})

/**
 * List all suspended cards for the user
 */
export const listSuspendedCards = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'cardStates.listSuspendedCards', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null

        // Get all suspended cards
        const suspendedCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_suspended', (q) =>
            q.eq('userId', userId).eq('suspended', true),
          )
          .collect()

        // Fetch associated blocks and documents
        const cardsWithContent = await Promise.all(
          suspendedCards.map(async (cardState) => {
            const block = await ctx.db.get(cardState.blockId)
            if (!block) return null

            const document = await ctx.db.get(block.documentId)

            return {
              cardState,
              block,
              document: document
                ? { _id: document._id, title: document.title }
                : null,
            }
          }),
        )

        return cardsWithContent.filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )
      },
    )
  },
})

/**
 * Delete card states for a block (when block is deleted)
 */
export const deleteCardStatesForBlock = mutation({
  args: {
    blockId: v.id('blocks'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.deleteCardStatesForBlock', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Fetch the block and verify ownership
        const block = await ctx.db.get(args.blockId)
        if (!block) {
          throw new Error('Block not found')
        }
        if (block.userId !== userId) {
          throw new Error('Not authorized to delete card states for this block')
        }

        // Find all card states for this block
        const cardStates = await ctx.db
          .query('cardStates')
          .withIndex('by_block_direction', (q) => q.eq('blockId', args.blockId))
          .collect()

        // Delete them all
        for (const cardState of cardStates) {
          // Delete associated review logs first
          const logs = await ctx.db
            .query('reviewLogs')
            .withIndex('by_cardState', (q) =>
              q.eq('cardStateId', cardState._id),
            )
            .collect()

          for (const log of logs) {
            await ctx.db.delete(log._id)
          }

          await ctx.db.delete(cardState._id)
        }

        return cardStates.length
      },
    )
  },
})

/**
 * List all leech cards (suspended AND unsuspended) with metadata
 */
export const listLeechCards = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'cardStates.listLeechCards', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null

        // Get all card states for the user
        const allCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due', (q) => q.eq('userId', userId))
          .collect()

        // Batch-fetch all retention rates in one query
        const retentionMap = await fetchRetentionMap(ctx, userId)

        // Filter for leeches and fetch block/document metadata
        const leechCardsData = await Promise.all(
          allCards.map(async (cardState) => {
            const retention = retentionMap.get(cardState._id) ?? null
            const isLeechCard = isLeech(cardState, retention)

            if (!isLeechCard) return null

            const leechReason = getLeechReason(cardState, retention)
            const block = await ctx.db.get(cardState.blockId)
            if (!block) return null

            const document = await ctx.db.get(block.documentId)

            return {
              cardState,
              block,
              document: document
                ? { _id: document._id, title: document.title }
                : null,
              retention,
              leechReason,
            }
          }),
        )

        return leechCardsData.filter(
          (c): c is NonNullable<typeof c> => c !== null,
        )
      },
    )
  },
})

/**
 * Get aggregate statistics for leech cards
 */
export const getLeechStats = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getLeechStats', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null

        // Get all card states for the user
        const allCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due', (q) => q.eq('userId', userId))
          .collect()

        let totalLeeches = 0
        let suspendedCount = 0
        let highLapsesCount = 0
        let lowRetentionCount = 0

        // Batch-fetch all retention rates in one query
        const retentionMap = await fetchRetentionMap(ctx, userId)

        for (const cardState of allCards) {
          const retention = retentionMap.get(cardState._id) ?? null
          const isLeechCard = isLeech(cardState, retention)

          if (isLeechCard) {
            totalLeeches++

            if (cardState.suspended === true) {
              suspendedCount++
            }

            if (cardState.lapses > 5) {
              highLapsesCount++
            }

            if (cardState.reps > 10 && retention !== null && retention < 40) {
              lowRetentionCount++
            }
          }
        }

        return {
          totalLeeches,
          suspendedCount,
          highLapsesCount,
          lowRetentionCount,
        }
      },
    )
  },
})

/**
 * Bulk suspend or unsuspend multiple cards
 */
export const bulkSuspendCards = mutation({
  args: {
    cardStateIds: v.array(v.id('cardStates')),
    suspend: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.bulkSuspendCards', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        // Verify ownership of all cards
        const cardStates = await Promise.all(
          args.cardStateIds.map((id) => ctx.db.get(id)),
        )

        for (const cardState of cardStates) {
          if (!cardState) {
            throw new Error('Card state not found')
          }
          if (cardState.userId !== userId) {
            throw new Error('Not authorized to suspend this card')
          }
        }

        // Update all cards
        await Promise.all(
          args.cardStateIds.map((id) =>
            ctx.db.patch(id, {
              suspended: args.suspend,
              suspendedAt: args.suspend ? Date.now() : undefined,
            }),
          ),
        )

        return { updatedCount: args.cardStateIds.length }
      },
    )
  },
})

/**
 * Get analytics dashboard data for learning insights
 */
export const getAnalyticsDashboard = query({
  args: {
    rangeDays: v.optional(v.number()),
    reviewLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'cardStates.getAnalyticsDashboard', op: 'convex.query' },
      async () => {
        const userId = await getUser(ctx)
        if (!userId) return null
        const now = Date.now()
        const rangeDays = Math.min(
          Math.max(Math.trunc(args.rangeDays ?? 90), 7),
          180,
        )
        const reviewLimit = Math.min(
          Math.max(args.reviewLimit ?? 10000, 100),
          50000,
        )
        const rangeStart = startOfDayUtc(now - (rangeDays - 1) * DAY_MS)

        const [reviewLogs, cardStates] = await Promise.all([
          ctx.db
            .query('reviewLogs')
            .withIndex('by_user_date', (q) =>
              q.eq('userId', userId).gte('reviewedAt', rangeStart),
            )
            .order('desc')
            .take(reviewLimit),
          ctx.db
            .query('cardStates')
            .withIndex('by_user_due', (q) => q.eq('userId', userId))
            .collect(),
        ])

        const activeCardStates = cardStates.filter(
          (card) => card.suspended !== true,
        )

        const cardStateMap = new Map(cardStates.map((card) => [card._id, card]))

        const uniqueBlockIds = Array.from(
          new Set(cardStates.map((card) => card.blockId)),
        )

        const blocks = await Promise.all(
          uniqueBlockIds.map((blockId) => ctx.db.get(blockId)),
        )

        const blockTypeMap = new Map(
          blocks
            .filter(
              (block): block is NonNullable<typeof block> => block !== null,
            )
            .map((block) => [block._id, block.cardType ?? 'unknown']),
        )

        // Difficulty distribution
        const difficultyStats = difficultyBuckets.map((bucket) => ({
          label: bucket.label,
          count: 0,
        }))

        for (const card of activeCardStates) {
          const value = Math.max(1, Math.min(10, card.difficulty))
          const bucketIndex = difficultyBuckets.findIndex(
            (bucket) => value >= bucket.min && value <= bucket.max,
          )
          if (bucketIndex >= 0) {
            difficultyStats[bucketIndex].count += 1
          }
        }

        // Retention trends (daily buckets)
        const dailyRetention = Array.from(
          { length: rangeDays },
          (_, index) => ({
            date: rangeStart + index * DAY_MS,
            total: 0,
            correct: 0,
            rate: null as number | null,
            rolling7: null as number | null,
            rolling30: null as number | null,
            rolling90: null as number | null,
          }),
        )

        // Retention by card type
        const cardTypeStats = new Map<
          string,
          { total: number; correct: number }
        >()

        // Interval performance
        const intervalStats = intervalBuckets.map((bucket) => ({
          label: bucket.label,
          total: 0,
          correct: 0,
          rate: null as number | null,
        }))

        const hourlyStats = Array.from({ length: 24 }, () => ({
          total: 0,
          correct: 0,
        }))

        for (const log of reviewLogs) {
          // Daily retention buckets
          const bucketIndex = Math.floor((log.reviewedAt - rangeStart) / DAY_MS)
          if (bucketIndex >= 0 && bucketIndex < dailyRetention.length) {
            dailyRetention[bucketIndex].total += 1
            if (log.rating >= 3) {
              dailyRetention[bucketIndex].correct += 1
            }
          }

          // Card-type retention
          const cardState = cardStateMap.get(log.cardStateId)
          if (cardState) {
            const cardType = blockTypeMap.get(cardState.blockId) ?? 'unknown'
            const current = cardTypeStats.get(cardType) ?? {
              total: 0,
              correct: 0,
            }
            current.total += 1
            if (log.rating >= 3) {
              current.correct += 1
            }
            cardTypeStats.set(cardType, current)
          }

          // Interval performance
          const scheduledDays = Math.max(0, log.scheduledDays)
          const intervalIndex = intervalBuckets.findIndex(
            (bucket) =>
              scheduledDays >= bucket.min && scheduledDays <= bucket.max,
          )
          if (intervalIndex >= 0) {
            intervalStats[intervalIndex].total += 1
            if (log.rating >= 3) {
              intervalStats[intervalIndex].correct += 1
            }
          }

          // Hourly distribution
          const hour = new Date(log.reviewedAt).getUTCHours()
          hourlyStats[hour].total += 1
          if (log.rating >= 3) {
            hourlyStats[hour].correct += 1
          }
        }

        const totalPrefix: Array<number> = [0]
        const correctPrefix: Array<number> = [0]

        for (const day of dailyRetention) {
          totalPrefix.push(totalPrefix[totalPrefix.length - 1] + day.total)
          correctPrefix.push(
            correctPrefix[correctPrefix.length - 1] + day.correct,
          )
        }

        const rollingRate = (index: number, window: number) => {
          if (index + 1 < window) return null
          const startIndex = index + 1 - window
          const total = totalPrefix[index + 1] - totalPrefix[startIndex]
          const correct = correctPrefix[index + 1] - correctPrefix[startIndex]
          return toRate(correct, total)
        }

        for (let i = 0; i < dailyRetention.length; i += 1) {
          const day = dailyRetention[i]
          day.rate = toRate(day.correct, day.total)
          day.rolling7 = rollingRate(i, 7)
          day.rolling30 = rollingRate(i, 30)
          day.rolling90 = rollingRate(i, 90)
        }

        const cardTypeOrder = [
          'basic',
          'concept',
          'descriptor',
          'cloze',
          'unknown',
        ]
        const retentionByCardType = cardTypeOrder
          .filter((type) => cardTypeStats.has(type))
          .map((type) => {
            const stats = cardTypeStats.get(type)!
            return {
              cardType: type,
              total: stats.total,
              correct: stats.correct,
              rate: toRate(stats.correct, stats.total),
            }
          })

        for (const bucket of intervalStats) {
          bucket.rate = toRate(bucket.correct, bucket.total)
        }

        const minOptimalSamples = 25
        const intervalCandidates = intervalStats.filter(
          (bucket) => bucket.total >= minOptimalSamples && bucket.rate !== null,
        )
        const intervalFallback = intervalStats.filter(
          (bucket) => bucket.total > 0,
        )
        const optimalIntervalSource =
          intervalCandidates.length > 0 ? intervalCandidates : intervalFallback
        const optimalInterval =
          optimalIntervalSource.length > 0
            ? optimalIntervalSource
                .slice()
                .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0]
            : null

        // Time analytics
        const sortedLogs = reviewLogs
          .slice()
          .sort((a, b) => a.reviewedAt - b.reviewedAt)

        const maxGapMs = 15 * 60 * 1000
        let totalStudyMs = 0
        let intervalCount = 0
        let dailyStudyMs = 0
        let weeklyStudyMs = 0
        let monthlyStudyMs = 0

        const dayWindow = DAY_MS
        const weekWindow = 7 * DAY_MS
        const monthWindow = 30 * DAY_MS

        for (let i = 1; i < sortedLogs.length; i += 1) {
          const current = sortedLogs[i]
          const previous = sortedLogs[i - 1]
          const delta = current.reviewedAt - previous.reviewedAt
          if (delta <= 0 || delta > maxGapMs) continue
          totalStudyMs += delta
          intervalCount += 1

          if (current.reviewedAt >= now - dayWindow) {
            dailyStudyMs += delta
          }
          if (current.reviewedAt >= now - weekWindow) {
            weeklyStudyMs += delta
          }
          if (current.reviewedAt >= now - monthWindow) {
            monthlyStudyMs += delta
          }
        }

        const hourlyPerformance = hourlyStats.map((hour, index) => ({
          hourUtc: index,
          total: hour.total,
          rate: toRate(hour.correct, hour.total),
        }))

        const peakCandidates = hourlyPerformance.filter(
          (hour) => hour.total > 0,
        )
        const peakFiltered = peakCandidates.filter((hour) => hour.total >= 5)
        const peakSource =
          peakFiltered.length > 0 ? peakFiltered : peakCandidates
        const peakHours = peakSource
          .slice()
          .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
          .slice(0, 3)

        // Forecasting: due cards next 30 days
        const forecastDays = 30
        const forecastStart = startOfDayUtc(now)
        const dueCounts = Array.from({ length: forecastDays }, (_, index) => ({
          date: forecastStart + index * DAY_MS,
          count: 0,
        }))

        for (const card of activeCardStates) {
          if (card.due < forecastStart) continue
          const dayIndex = Math.floor((card.due - forecastStart) / DAY_MS)
          if (dayIndex >= 0 && dayIndex < dueCounts.length) {
            dueCounts[dayIndex].count += 1
          }
        }

        const totalDueNext30 = dueCounts.reduce(
          (sum, day) => sum + day.count,
          0,
        )

        return {
          retention: {
            daily: dailyRetention,
            byCardType: retentionByCardType,
            intervalBuckets: intervalStats,
            optimalInterval,
          },
          difficulty: {
            buckets: difficultyStats,
            total: activeCardStates.length,
          },
          time: {
            avgTimePerCardMs:
              intervalCount > 0 ? totalStudyMs / intervalCount : null,
            totalStudyTimeMs: {
              daily: dailyStudyMs,
              weekly: weeklyStudyMs,
              monthly: monthlyStudyMs,
            },
            hourlyPerformance,
            peakHours,
          },
          forecast: {
            duePerDay: dueCounts,
            totalDueNext30,
            averagePerDay: totalDueNext30 / forecastDays,
          },
          meta: {
            rangeDays,
            rangeStart,
            generatedAt: now,
            reviewLogsTruncated: reviewLogs.length >= reviewLimit,
          },
        }
      },
    )
  },
})
