/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

/**
 * Helper to parse retrievability value.
 * The ts-fsrs library may return retrievability as a formatted string like "90.00%"
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

function toSnapshot(cardState: {
  stability: number
  difficulty: number
  due: number
  lastReview?: number
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  scheduledDays: number
  elapsedDays: number
}) {
  return {
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
}

/**
 * Create an authenticated test context with a user in the database
 */
async function createAuthenticatedContext(t: ReturnType<typeof convexTest>) {
  const workosId = `test-workos-${Date.now()}-${Math.random()}`
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      workosId,
      email: 'test@example.com',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })
  const asUser = t.withIdentity({ subject: workosId })
  return { userId, asUser, workosId }
}

/**
 * Create a test document
 */
async function createTestDocument(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  title: string = 'Test Document',
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('documents', {
      userId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })
}

/**
 * Create a test flashcard block
 */
async function createTestFlashcardBlock(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  documentId: Id<'documents'>,
  options: {
    cardType?: 'basic' | 'concept' | 'descriptor' | 'cloze'
    cardDirection?: 'forward' | 'reverse' | 'bidirectional' | 'disabled'
    cardFront?: string
    cardBack?: string
    textContent?: string
    position?: number
    attrs?: Record<string, unknown>
  } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('blocks', {
      documentId,
      userId,
      nodeId: `node-${Date.now()}-${Math.random()}`,
      type: 'paragraph',
      content: {},
      textContent: options.textContent ?? 'Test flashcard',
      position: options.position ?? 0,
      attrs: options.attrs,
      isCard: true,
      cardType: options.cardType ?? 'basic',
      cardDirection: options.cardDirection ?? 'forward',
      cardFront: options.cardFront ?? 'Front',
      cardBack: options.cardBack ?? 'Back',
    })
  })
}

/**
 * Create a test card state directly in the database
 */
async function createTestCardState(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  blockId: Id<'blocks'>,
  options: {
    direction?: 'forward' | 'reverse'
    state?: 'new' | 'learning' | 'review' | 'relearning'
    due?: number
    stability?: number
    difficulty?: number
    reps?: number
    lapses?: number
    lastReview?: number
    scheduledDays?: number
    elapsedDays?: number
    suspended?: boolean
  } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('cardStates', {
      blockId,
      userId,
      direction: options.direction ?? 'forward',
      state: options.state ?? 'new',
      due: options.due ?? Date.now(),
      stability: options.stability ?? 0,
      difficulty: options.difficulty ?? 0,
      reps: options.reps ?? 0,
      lapses: options.lapses ?? 0,
      lastReview: options.lastReview,
      scheduledDays: options.scheduledDays ?? 0,
      elapsedDays: options.elapsedDays ?? 0,
      suspended: options.suspended ?? false,
    })
  })
}

/**
 * Create a test review log
 */
async function createTestReviewLog(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  cardStateId: Id<'cardStates'>,
  options: {
    rating?: number
    state?: 'new' | 'learning' | 'review' | 'relearning'
    scheduledDays?: number
    elapsedDays?: number
    stability?: number
    difficulty?: number
    reviewedAt?: number
  } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('reviewLogs', {
      cardStateId,
      userId,
      rating: options.rating ?? 3,
      state: options.state ?? 'new',
      scheduledDays: options.scheduledDays ?? 0,
      elapsedDays: options.elapsedDays ?? 0,
      stability: options.stability ?? 1,
      difficulty: options.difficulty ?? 5,
      reviewedAt: options.reviewedAt ?? Date.now(),
    })
  })
}

describe('cardStates', () => {
  let t: ReturnType<typeof convexTest>
  let userId: Id<'users'>
  let asUser: ReturnType<ReturnType<typeof convexTest>['withIdentity']>
  let documentId: Id<'documents'>

  beforeEach(async () => {
    t = convexTest(schema, modules)
    const context = await createAuthenticatedContext(t)
    userId = context.userId
    asUser = context.asUser
    documentId = await createTestDocument(t, userId)
  })

  describe('reviewCard', () => {
    describe('state transitions', () => {
      it('should transition new card to learning with rating 1 (Again)', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'new',
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 1,
        })

        expect(result.state).toBe('learning')
      })

      it('should transition new card to review with rating 4 (Easy)', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'new',
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 4,
        })

        expect(result.state).toBe('review')
      })

      it('should graduate learning card to review on rating 4 (Easy)', async () => {
        const now = Date.now()
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'learning',
          stability: 1.5,
          difficulty: 5,
          reps: 1,
          lastReview: now - 30 * 60 * 1000, // 30 mins ago
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 4,
        })

        expect(result.state).toBe('review')
      })

      it('should move review card to relearning on rating 1 (Again)', async () => {
        const now = Date.now()
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'review',
          stability: 10,
          difficulty: 5,
          reps: 5,
          lapses: 0,
          lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 1,
        })

        expect(result.state).toBe('relearning')

        // Verify lapses increased
        const updatedCard = await t.run(async (ctx) => {
          return await ctx.db.get(cardStateId)
        })
        expect(updatedCard?.lapses).toBe(1)
      })

      it('should keep review card in review on rating 3 (Good)', async () => {
        const now = Date.now()
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'review',
          stability: 10,
          difficulty: 5,
          reps: 5,
          lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 3,
        })

        expect(result.state).toBe('review')
      })
    })

    describe('FSRS integration', () => {
      it('should update stability and difficulty after review', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'new',
          stability: 0,
          difficulty: 0,
        })

        await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 3,
        })

        const updatedCard = await t.run(async (ctx) => {
          return await ctx.db.get(cardStateId)
        })
        expect(updatedCard?.stability).toBeGreaterThan(0)
        expect(updatedCard?.difficulty).toBeGreaterThanOrEqual(0)
      })

      it('should set due date in future after successful review', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const now = Date.now()
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'review',
          stability: 10,
          difficulty: 5,
          reps: 5,
          due: now,
          lastReview: now - 10 * 24 * 60 * 60 * 1000,
        })

        const result = await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 3,
        })

        expect(result.nextDue).toBeGreaterThan(now)
        expect(result.scheduledDays).toBeGreaterThan(0)
      })
    })

    describe('review log creation', () => {
      it('should create review log with correct data', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId, {
          state: 'new',
        })

        await asUser.mutation(api.cardStates.reviewCard, {
          cardStateId,
          rating: 3,
        })

        const logs = await t.run(async (ctx) => {
          return await ctx.db
            .query('reviewLogs')
            .filter((q) => q.eq(q.field('cardStateId'), cardStateId))
            .collect()
        })

        expect(logs).toHaveLength(1)
        expect(logs[0].rating).toBe(3)
        expect(logs[0].state).toBe('new') // Previous state
        expect(logs[0].userId).toEqual(userId)
        expect(logs[0].reviewedAt).toBeGreaterThan(0)
      })
    })

    describe('authorization', () => {
      it('should reject unauthenticated users', async () => {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId)

        await expect(
          t.mutation(api.cardStates.reviewCard, {
            cardStateId,
            rating: 3,
          }),
        ).rejects.toThrow('Not authenticated')
      })

      it("should reject other user's cards", async () => {
        const { asUser: asOtherUser } = await createAuthenticatedContext(t)
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        const cardStateId = await createTestCardState(t, userId, blockId)

        await expect(
          asOtherUser.mutation(api.cardStates.reviewCard, {
            cardStateId,
            rating: 3,
          }),
        ).rejects.toThrow('Not authorized to review this card')
      })
    })
  })

  describe('undoReview', () => {
    it('should restore previous card state and delete review log', async () => {
      const now = Date.now()
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now - 1000,
        stability: 5,
        difficulty: 6,
        reps: 3,
        lapses: 1,
        lastReview: now - 2 * 24 * 60 * 60 * 1000,
        scheduledDays: 7,
        elapsedDays: 2,
      })

      const before = await t.run(async (ctx) => ctx.db.get(cardStateId))
      if (!before) throw new Error('Card state not found')
      const previousState = toSnapshot(before)

      const reviewResult = await asUser.mutation(api.cardStates.reviewCard, {
        cardStateId,
        rating: 3,
      })

      const logsAfterReview = await t.run(async (ctx) => {
        return await ctx.db
          .query('reviewLogs')
          .filter((q) => q.eq(q.field('cardStateId'), cardStateId))
          .collect()
      })
      expect(logsAfterReview).toHaveLength(1)

      await asUser.mutation(api.cardStates.undoReview, {
        cardStateId,
        previousState,
        reviewLogId: reviewResult.reviewLogId,
      })

      const after = await t.run(async (ctx) => ctx.db.get(cardStateId))
      if (!after) throw new Error('Card state not found')

      expect(toSnapshot(after)).toEqual(previousState)

      const logsAfterUndo = await t.run(async (ctx) => {
        return await ctx.db
          .query('reviewLogs')
          .filter((q) => q.eq(q.field('cardStateId'), cardStateId))
          .collect()
      })
      expect(logsAfterUndo).toHaveLength(0)
    })

    it("should reject undo for another user's card", async () => {
      const { asUser: asOtherUser } = await createAuthenticatedContext(t)
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId)
      const before = await t.run(async (ctx) => ctx.db.get(cardStateId))
      if (!before) throw new Error('Card state not found')

      await expect(
        asOtherUser.mutation(api.cardStates.undoReview, {
          cardStateId,
          previousState: toSnapshot(before),
        }),
      ).rejects.toThrow('Not authorized to undo this review')
    })

    it('should reject mismatched review log', async () => {
      const blockA = await createTestFlashcardBlock(t, userId, documentId)
      const blockB = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateA = await createTestCardState(t, userId, blockA, {
        state: 'review',
      })
      const cardStateB = await createTestCardState(t, userId, blockB, {
        state: 'review',
      })

      const beforeA = await t.run(async (ctx) => ctx.db.get(cardStateA))
      if (!beforeA) throw new Error('Card state not found')

      await asUser.mutation(api.cardStates.reviewCard, {
        cardStateId: cardStateA,
        rating: 3,
      })
      const reviewB = await asUser.mutation(api.cardStates.reviewCard, {
        cardStateId: cardStateB,
        rating: 3,
      })

      await expect(
        asUser.mutation(api.cardStates.undoReview, {
          cardStateId: cardStateA,
          previousState: toSnapshot(beforeA),
          reviewLogId: reviewB.reviewLogId,
        }),
      ).rejects.toThrow('Review log does not match card state')
    })

    it('should reject stale review log when a newer review exists', async () => {
      const now = Date.now()
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now - 1000,
        stability: 5,
        difficulty: 6,
        reps: 3,
        lapses: 1,
        lastReview: now - 2 * 24 * 60 * 60 * 1000,
        scheduledDays: 7,
        elapsedDays: 2,
      })

      const firstReview = await asUser.mutation(api.cardStates.reviewCard, {
        cardStateId,
        rating: 3,
      })

      const afterFirstReview = await t.run(async (ctx) =>
        ctx.db.get(cardStateId),
      )
      if (!afterFirstReview) throw new Error('Card state not found')
      const previousState = toSnapshot(afterFirstReview)

      await asUser.mutation(api.cardStates.reviewCard, {
        cardStateId,
        rating: 3,
      })

      const afterSecondReview = await t.run(async (ctx) =>
        ctx.db.get(cardStateId),
      )
      if (!afterSecondReview) throw new Error('Card state not found')
      const snapshotAfterSecondReview = toSnapshot(afterSecondReview)

      await expect(
        asUser.mutation(api.cardStates.undoReview, {
          cardStateId,
          previousState,
          reviewLogId: firstReview.reviewLogId,
        }),
      ).rejects.toThrow('Review log does not match latest review')

      const after = await t.run(async (ctx) => ctx.db.get(cardStateId))
      if (!after) throw new Error('Card state not found')
      expect(toSnapshot(after)).toEqual(snapshotAfterSecondReview)
    })
  })

  describe('getDueCards', () => {
    it('should return null for unauthenticated users', async () => {
      const result = await t.query(api.cardStates.getDueCards, {})
      expect(result).toBeNull()
    })

    it('should return cards where due <= now', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const now = Date.now()
      await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now - 1000, // Due in the past
        stability: 10,
        difficulty: 5,
        lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      })

      const result = (await asUser.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(1)
    })

    it('should exclude cards where due > now', async () => {
      const now = Date.now()
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now + 24 * 60 * 60 * 1000, // Due in 1 day
        stability: 10,
        difficulty: 5,
      })

      const result = (await asUser.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(0)
    })

    it('should sort by retrievability (lowest first)', async () => {
      const now = Date.now()

      // Card with very low stability - will have low retrievability (should come first)
      const blockLowR = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockLowR, {
        state: 'review',
        due: now - 1000,
        stability: 1, // Low stability
        difficulty: 5,
        lastReview: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago - very overdue
      })

      // Card with high stability - will have high retrievability (should come second)
      const blockHighR = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockHighR, {
        state: 'review',
        due: now - 1000,
        stability: 100, // Very high stability
        difficulty: 5,
        lastReview: now - 1 * 24 * 60 * 60 * 1000, // 1 day ago - barely overdue
      })

      const result = (await asUser.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(2)
      // Verify the cards are returned (sorted by retrievability, lowest first)
      const retrievabilities = result.map((r) =>
        parseRetrievability(r.retrievability),
      )
      // The array should be sorted ascending
      expect(retrievabilities[0]).toBeLessThanOrEqual(retrievabilities[1])
    })

    it('should respect limit parameter', async () => {
      const now = Date.now()

      // Create 5 due cards
      for (let i = 0; i < 5; i++) {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        await createTestCardState(t, userId, blockId, {
          state: 'review',
          due: now - 1000,
          stability: 10,
          difficulty: 5,
          lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        })
      }

      const result = (await asUser.query(api.cardStates.getDueCards, {
        limit: 3,
      }))!

      expect(result.length).toBe(3)
    })

    it('should return enriched data with block, document, and intervalPreviews', async () => {
      const now = Date.now()
      const customDocId = await createTestDocument(t, userId, 'My Document')
      const blockId = await createTestFlashcardBlock(t, userId, customDocId, {
        cardFront: 'Question',
        cardBack: 'Answer',
      })
      await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now - 1000,
        stability: 10,
        difficulty: 5,
        lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      })

      const result = (await asUser.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(1)
      expect(result[0].block).toBeDefined()
      expect(result[0].block.cardFront).toBe('Question')
      expect(result[0].document).toBeDefined()
      expect(result[0].document?.title).toBe('My Document')
      expect(result[0].retrievability).toBeDefined()
      expect(result[0].intervalPreviews).toBeDefined()
      expect(result[0].intervalPreviews.again).toBeDefined()
      expect(result[0].intervalPreviews.good).toBeDefined()
    })

    it('should exclude disabled cards', async () => {
      const now = Date.now()
      const blockId = await createTestFlashcardBlock(t, userId, documentId, {
        cardDirection: 'disabled',
      })
      await createTestCardState(t, userId, blockId, {
        state: 'review',
        due: now - 1000,
        stability: 10,
        difficulty: 5,
      })

      const result = (await asUser.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(0)
    })

    it('should only return cards for authenticated user (user isolation)', async () => {
      const { userId: user2Id, asUser: asUser2 } =
        await createAuthenticatedContext(t)
      const now = Date.now()

      // Create card for user1 (from beforeEach)
      const block1 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block1, {
        state: 'review',
        due: now - 1000,
        stability: 10,
        lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      })

      // Create card for user2
      const doc2 = await createTestDocument(t, user2Id)
      const block2 = await createTestFlashcardBlock(t, user2Id, doc2)
      await createTestCardState(t, user2Id, block2, {
        state: 'review',
        due: now - 1000,
        stability: 10,
        lastReview: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      })

      // User2 should only see their own card
      const result = (await asUser2.query(api.cardStates.getDueCards, {}))!

      expect(result.length).toBe(1)
      expect(result[0].cardState.userId).toEqual(user2Id)
    })
  })

  describe('getNewCards', () => {
    it('should return only cards in new state', async () => {
      // Create new card
      const blockNew = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockNew, { state: 'new' })

      // Create review card (should not be returned)
      const blockReview = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockReview, { state: 'review' })

      const result = (await asUser.query(api.cardStates.getNewCards, {}))!

      expect(result.length).toBe(1)
      expect(result[0].cardState.state).toBe('new')
    })

    it('should respect limit parameter', async () => {
      // Create 5 new cards
      for (let i = 0; i < 5; i++) {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        await createTestCardState(t, userId, blockId, { state: 'new' })
      }

      const result = (await asUser.query(api.cardStates.getNewCards, {
        limit: 2,
      }))!

      expect(result.length).toBe(2)
    })

    it('should return retrievability as 0 for new cards', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockId, { state: 'new' })

      const result = (await asUser.query(api.cardStates.getNewCards, {}))!

      expect(result.length).toBe(1)
      expect(result[0].retrievability).toBe(0)
    })

    it('should return interval previews', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockId, { state: 'new' })

      const result = (await asUser.query(api.cardStates.getNewCards, {}))!

      expect(result[0].intervalPreviews).toBeDefined()
      expect(result[0].intervalPreviews.again).toBeDefined()
      expect(result[0].intervalPreviews.hard).toBeDefined()
      expect(result[0].intervalPreviews.good).toBeDefined()
      expect(result[0].intervalPreviews.easy).toBeDefined()
    })

    it('should exclude disabled cards', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId, {
        cardDirection: 'disabled',
      })
      await createTestCardState(t, userId, blockId, { state: 'new' })

      const result = (await asUser.query(api.cardStates.getNewCards, {}))!

      expect(result.length).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should count cards by state correctly', async () => {
      // Create cards in different states
      const block1 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block1, { state: 'new' })

      const block2 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block2, { state: 'new' })

      const block3 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block3, { state: 'learning' })

      const block4 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block4, { state: 'relearning' })

      const block5 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block5, { state: 'review' })

      const stats = (await asUser.query(api.cardStates.getStats, {}))!

      expect(stats.totalCards).toBe(5)
      expect(stats.newCards).toBe(2)
      expect(stats.learningCards).toBe(2) // learning + relearning
      expect(stats.reviewCards).toBe(1)
    })

    it('should calculate dueNow correctly (learning/review where due <= now)', async () => {
      const now = Date.now()

      // Due learning card
      const block1 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block1, {
        state: 'learning',
        due: now - 1000,
      })

      // Not due learning card
      const block2 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block2, {
        state: 'learning',
        due: now + 60000,
      })

      // Due review card
      const block3 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block3, {
        state: 'review',
        due: now - 1000,
      })

      // New card (not counted in dueNow)
      const block4 = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, block4, {
        state: 'new',
        due: now - 1000,
      })

      const stats = (await asUser.query(api.cardStates.getStats, {}))!

      expect(stats.dueNow).toBe(2) // 1 learning + 1 review
    })

    it("should count reviewedToday from today's review logs only", async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId, {
        state: 'review',
      })

      // Fix time at noon to avoid midnight edge cases
      const fixedDate = new Date('2024-06-15T12:00:00.000Z')
      const now = fixedDate.getTime()
      const todayStart = new Date(fixedDate)
      todayStart.setHours(0, 0, 0, 0)

      vi.useFakeTimers()
      vi.setSystemTime(fixedDate)

      try {
        // Today's reviews
        await createTestReviewLog(t, userId, cardStateId, {
          reviewedAt: now - 1000,
          rating: 3,
        })
        await createTestReviewLog(t, userId, cardStateId, {
          reviewedAt: now - 2000,
          rating: 4,
        })

        // Yesterday's review (should not be counted)
        await createTestReviewLog(t, userId, cardStateId, {
          reviewedAt: todayStart.getTime() - 1000,
          rating: 3,
        })

        const stats = (await asUser.query(api.cardStates.getStats, {}))!

        expect(stats.reviewedToday).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should calculate retention rate = (ratings >= 3) / total * 100', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId)

      const now = Date.now()

      // 3 correct reviews (ratings 3 and 4)
      await createTestReviewLog(t, userId, cardStateId, {
        reviewedAt: now - 1000,
        rating: 3,
      })
      await createTestReviewLog(t, userId, cardStateId, {
        reviewedAt: now - 2000,
        rating: 4,
      })
      await createTestReviewLog(t, userId, cardStateId, {
        reviewedAt: now - 3000,
        rating: 3,
      })

      // 1 incorrect review (rating < 3)
      await createTestReviewLog(t, userId, cardStateId, {
        reviewedAt: now - 4000,
        rating: 1,
      })

      const stats = (await asUser.query(api.cardStates.getStats, {}))!

      // 3 correct / 4 total = 75%
      expect(stats.retentionRate).toBe(75)
    })

    it('should return null retentionRate when no reviews today', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockId)

      // No review logs created

      const stats = (await asUser.query(api.cardStates.getStats, {}))!

      expect(stats.retentionRate).toBeNull()
      expect(stats.reviewedToday).toBe(0)
    })

    it('should return zeros for user with no cards', async () => {
      // Create a fresh user with no cards
      const { asUser: freshUser } = await createAuthenticatedContext(t)

      const stats = (await freshUser.query(api.cardStates.getStats, {}))!

      expect(stats.totalCards).toBe(0)
      expect(stats.newCards).toBe(0)
      expect(stats.learningCards).toBe(0)
      expect(stats.reviewCards).toBe(0)
      expect(stats.dueNow).toBe(0)
      expect(stats.reviewedToday).toBe(0)
      expect(stats.retentionRate).toBeNull()
    })
  })

  describe('listCardsByDifficultyBucket', () => {
    const listCardsByDifficultyBucketRef =
      api.cardStates.listCardsByDifficultyBucket

    it('returns null for unauthenticated users', async () => {
      const result = await t.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
      })

      expect(result).toBeNull()
    })

    it('filters cards by the selected bucket range', async () => {
      const inRangeBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, inRangeBlock, {
        difficulty: 6,
        lapses: 1,
        due: Date.now() + 1000,
      })

      const outOfRangeBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      await createTestCardState(t, userId, outOfRangeBlock, {
        difficulty: 8,
        lapses: 10,
        due: Date.now(),
      })

      const result = (await asUser.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
      }))!

      expect(result.bucketLabel).toBe('5-6')
      expect(result.totalMatching).toBe(1)
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0].cardState.difficulty).toBe(6)
    })

    it('includes fractional values within continuous bucket ranges', async () => {
      const inRangeBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, inRangeBlock, {
        difficulty: 6.7,
      })

      const outOfRangeBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      await createTestCardState(t, userId, outOfRangeBlock, {
        difficulty: 7,
      })

      const result = (await asUser.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
      }))!

      expect(result.totalMatching).toBe(1)
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0].cardState.difficulty).toBe(6.7)
    })

    it('excludes suspended cards from results', async () => {
      const activeBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, activeBlock, {
        difficulty: 5,
        suspended: false,
      })

      const suspendedBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      await createTestCardState(t, userId, suspendedBlock, {
        difficulty: 5,
        suspended: true,
      })

      const result = (await asUser.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
      }))!

      expect(result.totalMatching).toBe(1)
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0].cardState.suspended).toBe(false)
    })

    it('sorts by lapses desc, then due asc, then difficulty desc', async () => {
      const now = Date.now()

      const highestLapsesBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      const highestLapsesCard = await createTestCardState(
        t,
        userId,
        highestLapsesBlock,
        {
          difficulty: 5.2,
          lapses: 7,
          due: now + 30_000,
        },
      )

      const tieDueEarlierBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      const tieDueEarlierCard = await createTestCardState(
        t,
        userId,
        tieDueEarlierBlock,
        {
          difficulty: 5.1,
          lapses: 4,
          due: now + 1_000,
        },
      )

      const tieDueLaterHigherDifficultyBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      const tieDueLaterHigherDifficultyCard = await createTestCardState(
        t,
        userId,
        tieDueLaterHigherDifficultyBlock,
        {
          difficulty: 6,
          lapses: 4,
          due: now + 10_000,
        },
      )

      const tieDueLaterLowerDifficultyBlock = await createTestFlashcardBlock(
        t,
        userId,
        documentId,
      )
      const tieDueLaterLowerDifficultyCard = await createTestCardState(
        t,
        userId,
        tieDueLaterLowerDifficultyBlock,
        {
          difficulty: 5.3,
          lapses: 4,
          due: now + 10_000,
        },
      )

      const result = (await asUser.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
      }))!
      const orderedIds = result.cards.map(
        (item: { cardState: { _id: string } }) => item.cardState._id,
      )

      expect(orderedIds).toEqual([
        highestLapsesCard,
        tieDueEarlierCard,
        tieDueLaterHigherDifficultyCard,
        tieDueLaterLowerDifficultyCard,
      ])
    })

    it('respects limit and still returns total matching count', async () => {
      for (let i = 0; i < 3; i += 1) {
        const blockId = await createTestFlashcardBlock(t, userId, documentId)
        await createTestCardState(t, userId, blockId, {
          difficulty: 6,
          lapses: i,
          due: Date.now() + i * 1000,
        })
      }

      const result = (await asUser.query(listCardsByDifficultyBucketRef, {
        bucketLabel: '5-6',
        limit: 2,
      }))!

      expect(result.totalMatching).toBe(3)
      expect(result.cards).toHaveLength(2)
    })
  })

  describe('getAnalyticsDashboard', () => {
    it('assigns fractional difficulty values to continuous buckets', async () => {
      const firstBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, firstBlock, {
        difficulty: 2.5,
      })

      const secondBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, secondBlock, {
        difficulty: 4.3,
      })

      const thirdBlock = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, thirdBlock, {
        difficulty: 6.8,
      })

      const result = (await asUser.query(api.cardStates.getAnalyticsDashboard, {
        rangeDays: 30,
      }))!

      const countByLabel = new Map(
        result.difficulty.buckets.map((bucket) => [bucket.label, bucket.count]),
      )

      expect(countByLabel.get('1-2')).toBe(1)
      expect(countByLabel.get('3-4')).toBe(1)
      expect(countByLabel.get('5-6')).toBe(1)
    })
  })

  describe('learn session ancestor context', () => {
    it('getLearnSession should include block.ancestorPath from outlineAncestorNodeIds', async () => {
      const now = Date.now()
      const sessionDocId = await createTestDocument(t, userId, 'Biology Notes')
      const ancestorNodeId = 'ancestor-node'

      await t.run(async (ctx) => {
        await ctx.db.insert('blocks', {
          documentId: sessionDocId,
          userId,
          nodeId: ancestorNodeId,
          type: 'paragraph',
          content: {},
          textContent: 'Cell',
          position: 0,
          isCard: false,
        })
      })

      const cardBlockId = await createTestFlashcardBlock(
        t,
        userId,
        sessionDocId,
        {
          cardFront: 'Mitochondria',
          cardBack: 'Powerhouse',
          position: 1,
          attrs: { outlineAncestorNodeIds: [ancestorNodeId] },
        },
      )

      await createTestCardState(t, userId, cardBlockId, {
        state: 'review',
        due: now - 1000,
        stability: 10,
        difficulty: 5,
        lastReview: now - 10 * 24 * 60 * 60 * 1000,
      })

      const result = (await asUser.query(api.cardStates.getLearnSession, {}))!

      expect(result.length).toBe(1)
      expect(result[0]?.block.ancestorPath).toEqual(['Cell'])
    })

    it('getDocumentLearnSession should include block.ancestorPath from outlineAncestorNodeIds', async () => {
      const now = Date.now()
      const sessionDocId = await createTestDocument(
        t,
        userId,
        'Chemistry Notes',
      )
      const ancestorNodeId = 'ancestor-node'

      await t.run(async (ctx) => {
        await ctx.db.insert('blocks', {
          documentId: sessionDocId,
          userId,
          nodeId: ancestorNodeId,
          type: 'heading',
          content: {},
          textContent: 'Atoms',
          position: 0,
          attrs: { level: 1 },
          isCard: false,
        })
      })

      const cardBlockId = await createTestFlashcardBlock(
        t,
        userId,
        sessionDocId,
        {
          cardFront: 'Electron',
          cardBack: 'Negatively charged particle',
          position: 1,
          attrs: { outlineAncestorNodeIds: [ancestorNodeId] },
        },
      )

      await createTestCardState(t, userId, cardBlockId, {
        state: 'review',
        due: now - 1000,
        stability: 8,
        difficulty: 5,
        lastReview: now - 8 * 24 * 60 * 60 * 1000,
      })

      const result = (await asUser.query(
        api.cardStates.getDocumentLearnSession,
        {
          documentId: sessionDocId,
        },
      ))!

      expect(result.length).toBe(1)
      expect(result[0]?.block.ancestorPath).toEqual(['Atoms'])
    })
  })

  describe('getOrCreateCardState', () => {
    it('should create new card state if none exists', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)

      const cardStateId = await asUser.mutation(
        api.cardStates.getOrCreateCardState,
        {
          blockId,
          direction: 'forward',
        },
      )

      expect(cardStateId).toBeDefined()

      const cardState = await t.run(async (ctx) => {
        return await ctx.db.get(cardStateId)
      })
      expect(cardState?.state).toBe('new')
      expect(cardState?.direction).toBe('forward')
    })

    it('should return existing card state if one exists', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const existingId = await createTestCardState(t, userId, blockId, {
        direction: 'forward',
      })

      const returnedId = await asUser.mutation(
        api.cardStates.getOrCreateCardState,
        {
          blockId,
          direction: 'forward',
        },
      )

      expect(returnedId).toEqual(existingId)
    })

    it("should reject creating card state for another user's block", async () => {
      const { asUser: asOtherUser } = await createAuthenticatedContext(t)
      const blockId = await createTestFlashcardBlock(t, userId, documentId)

      await expect(
        asOtherUser.mutation(api.cardStates.getOrCreateCardState, {
          blockId,
          direction: 'forward',
        }),
      ).rejects.toThrow('Not authorized to create card state for this block')
    })
  })

  describe('ensureCardStates', () => {
    it('should create card states for multiple directions', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId, {
        cardDirection: 'bidirectional',
      })

      const cardStateIds = await asUser.mutation(
        api.cardStates.ensureCardStates,
        {
          blockId,
          directions: ['forward', 'reverse'],
        },
      )

      expect(cardStateIds).toHaveLength(2)

      const cardStates = await t.run(async (ctx) => {
        return await Promise.all(cardStateIds.map((id) => ctx.db.get(id)))
      })
      const directions = cardStates.map((s) => s?.direction).sort()
      expect(directions).toEqual(['forward', 'reverse'])
    })
  })

  describe('deleteCardStatesForBlock', () => {
    it('should delete all card states and review logs for a block', async () => {
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      const cardStateId = await createTestCardState(t, userId, blockId)
      await createTestReviewLog(t, userId, cardStateId)

      const deletedCount = await asUser.mutation(
        api.cardStates.deleteCardStatesForBlock,
        {
          blockId,
        },
      )

      expect(deletedCount).toBe(1)

      // Verify deletion
      const remainingCardStates = await t.run(async (ctx) => {
        return await ctx.db
          .query('cardStates')
          .filter((q) => q.eq(q.field('blockId'), blockId))
          .collect()
      })
      expect(remainingCardStates).toHaveLength(0)

      const remainingLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query('reviewLogs')
          .filter((q) => q.eq(q.field('cardStateId'), cardStateId))
          .collect()
      })
      expect(remainingLogs).toHaveLength(0)
    })

    it("should reject deleting another user's block card states", async () => {
      const { asUser: asOtherUser } = await createAuthenticatedContext(t)
      const blockId = await createTestFlashcardBlock(t, userId, documentId)
      await createTestCardState(t, userId, blockId)

      await expect(
        asOtherUser.mutation(api.cardStates.deleteCardStatesForBlock, {
          blockId,
        }),
      ).rejects.toThrow('Not authorized to delete card states for this block')
    })
  })
})
