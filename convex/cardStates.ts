import * as Sentry from '@sentry/tanstackstart-react'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'
import {
  createNewCardState,
  formatInterval,
  getRetrievability,
  previewIntervals,
  processReview,
} from './helpers/fsrs'
import type { CardState } from './helpers/fsrs'
import type { Id } from './_generated/dataModel'

// Direction validator
const directionValidator = v.union(v.literal('forward'), v.literal('reverse'))

// State validator
const stateValidator = v.union(
  v.literal('new'),
  v.literal('learning'),
  v.literal('review'),
  v.literal('relearning'),
)

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
        await ctx.db.insert('reviewLogs', {
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
        }
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
        const userId = await requireUser(ctx)
        const now = Date.now()
        const limit = args.limit ?? 50

        // Get all card states for the user that are due
        const dueCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due', (q) =>
            q.eq('userId', userId).lte('due', now),
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
        const userId = await requireUser(ctx)
        const limit = args.limit ?? 20

        // Get new cards
        const newCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_state', (q) =>
            q.eq('userId', userId).eq('state', 'new'),
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
        const userId = await requireUser(ctx)
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
        const userId = await requireUser(ctx)
        const now = Date.now()
        const newLimit = args.newLimit ?? 20
        const reviewLimit = args.reviewLimit ?? 100

        // Get due review cards (including learning/relearning)
        const dueCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_due', (q) =>
            q.eq('userId', userId).lte('due', now),
          )
          .take(reviewLimit)

        // Get new cards
        const newCards = await ctx.db
          .query('cardStates')
          .withIndex('by_user_state', (q) =>
            q.eq('userId', userId).eq('state', 'new'),
          )
          .take(newLimit)

        // Collect IDs of due cards to avoid duplicates
        // (new cards can have due=now and match both queries)
        const dueCardIds = new Set(dueCards.map((card) => card._id))
        const filteredNewCards = newCards.filter(
          (card) => !dueCardIds.has(card._id),
        )

        // Combine and fetch blocks
        const allCardStates = [...dueCards, ...filteredNewCards]

        const cardsWithBlocks = await Promise.all(
          allCardStates.map(async (cardState) => {
            const block = await ctx.db.get(cardState.blockId)
            if (!block || !block.isCard || block.cardDirection === 'disabled') {
              return null
            }

            // Get document for title
            const document = await ctx.db.get(block.documentId)

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
        // Verify document ownership before proceeding
        const { userId } = await requireDocumentAccess(ctx, args.documentId)
        const now = Date.now()
        const newLimit = args.newLimit ?? 20
        const reviewLimit = args.reviewLimit ?? 100

        // Get all blocks for this document that are flashcards
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

        // Flatten and filter by userId (security check) and due/state
        const allRelevantCards = allCardStatesForBlocks
          .flat()
          .filter((card) => card.userId === userId)

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

        const cardsWithBlocks = await Promise.all(
          allCardStates.map(async (cardState) => {
            const block = await ctx.db.get(cardState.blockId)
            if (!block || !block.isCard || block.cardDirection === 'disabled') {
              return null
            }

            // Get document for title
            const document = await ctx.db.get(block.documentId)

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
