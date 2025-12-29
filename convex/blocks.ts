import * as Sentry from '@sentry/tanstackstart-react'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'
import { createNewCardState } from './helpers/fsrs'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

type Direction = 'forward' | 'reverse'

// Flashcard validators (matching schema.ts)
const cardTypeValidator = v.optional(
  v.union(
    v.literal('basic'),
    v.literal('concept'),
    v.literal('descriptor'),
    v.literal('cloze'),
  ),
)

const cardDirectionValidator = v.optional(
  v.union(
    v.literal('forward'),
    v.literal('reverse'),
    v.literal('bidirectional'),
    v.literal('disabled'),
  ),
)

/**
 * Get the directions that need card states based on cardDirection
 */
function getDirectionsForCard(
  cardDirection: string | undefined,
): Array<Direction> {
  switch (cardDirection) {
    case 'forward':
      return ['forward']
    case 'reverse':
      return ['reverse']
    case 'bidirectional':
      return ['forward', 'reverse']
    default:
      return []
  }
}

/**
 * Cascade delete a block and all associated card states and review logs.
 * Deletes in order: reviewLogs → cardStates → block
 */
async function cascadeDeleteBlock(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
): Promise<void> {
  // Delete associated card states first
  const cardStates = await ctx.db
    .query('cardStates')
    .withIndex('by_block_direction', (q) => q.eq('blockId', blockId))
    .collect()

  for (const cardState of cardStates) {
    // Delete associated review logs
    const logs = await ctx.db
      .query('reviewLogs')
      .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
      .collect()

    for (const log of logs) {
      await ctx.db.delete(log._id)
    }
    await ctx.db.delete(cardState._id)
  }

  await ctx.db.delete(blockId)
}

/**
 * Create a new card state with FSRS defaults for a given block and direction.
 * This helper encapsulates the field mapping from createNewCardState() to the database insert.
 */
async function createCardState(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  userId: Id<'users'>,
  direction: Direction,
): Promise<void> {
  const newState = createNewCardState()
  await ctx.db.insert('cardStates', {
    blockId,
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
}

/**
 * Clean up orphaned card states when card direction changes.
 * Deletes card states that are no longer needed based on the new cardDirection.
 */
async function cleanupOrphanedCardStates(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  isCard: boolean | undefined,
  cardDirection: string | undefined,
): Promise<void> {
  // If not a card or disabled, delete all card states
  if (!isCard || cardDirection === 'disabled') {
    const allCardStates = await ctx.db
      .query('cardStates')
      .withIndex('by_block_direction', (q) => q.eq('blockId', blockId))
      .collect()

    for (const cardState of allCardStates) {
      // Delete associated review logs first
      const logs = await ctx.db
        .query('reviewLogs')
        .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
        .collect()

      for (const log of logs) {
        await ctx.db.delete(log._id)
      }
      await ctx.db.delete(cardState._id)
    }
    return
  }

  // Get the directions that should exist
  const neededDirections = getDirectionsForCard(cardDirection)
  const neededDirectionsSet = new Set(neededDirections)

  // Get all existing card states for this block
  const existingCardStates = await ctx.db
    .query('cardStates')
    .withIndex('by_block_direction', (q) => q.eq('blockId', blockId))
    .collect()

  // Delete card states that are not in the needed directions
  for (const cardState of existingCardStates) {
    if (!neededDirectionsSet.has(cardState.direction)) {
      // Delete associated review logs first
      const logs = await ctx.db
        .query('reviewLogs')
        .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
        .collect()

      for (const log of logs) {
        await ctx.db.delete(log._id)
      }
      await ctx.db.delete(cardState._id)
    }
  }
}

// Get all blocks for a document
export const listByDocument = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.listByDocument', op: 'convex.query' },
      async () => {
        await requireDocumentAccess(ctx, args.documentId)

        const blocks = await ctx.db
          .query('blocks')
          .withIndex('by_document_position', (q) =>
            q.eq('documentId', args.documentId),
          )
          .order('asc')
          .collect()

        return blocks
      },
    )
  },
})

// Upsert a single block (create or update by nodeId)
export const upsertBlock = mutation({
  args: {
    documentId: v.id('documents'),
    nodeId: v.string(),
    type: v.string(),
    content: v.any(),
    textContent: v.string(),
    position: v.number(),
    attrs: v.optional(v.any()),
    // Flashcard fields
    isCard: v.optional(v.boolean()),
    cardType: cardTypeValidator,
    cardDirection: cardDirectionValidator,
    cardFront: v.optional(v.string()),
    cardBack: v.optional(v.string()),
    clozeOcclusions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.upsertBlock', op: 'convex.mutation' },
      async () => {
        const { userId } = await requireDocumentAccess(ctx, args.documentId)

        // Check if block exists
        const existingBlock = await ctx.db
          .query('blocks')
          .withIndex('by_nodeId', (q) =>
            q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
          )
          .unique()

        if (existingBlock) {
          // Update existing block
          await ctx.db.patch(existingBlock._id, {
            type: args.type,
            content: args.content,
            textContent: args.textContent,
            position: args.position,
            attrs: args.attrs,
            userId, // Ensure userId is set (in case it was missing)
            // Flashcard fields
            isCard: args.isCard,
            cardType: args.cardType,
            cardDirection: args.cardDirection,
            cardFront: args.cardFront,
            cardBack: args.cardBack,
            clozeOcclusions: args.clozeOcclusions,
          })

          // Clean up orphaned card states when direction changes
          await cleanupOrphanedCardStates(
            ctx,
            existingBlock._id,
            args.isCard,
            args.cardDirection,
          )

          // Auto-create/update card states for flashcards
          if (args.isCard && args.cardDirection !== 'disabled') {
            const directions = getDirectionsForCard(args.cardDirection)
            for (const direction of directions) {
              // Check if card state exists
              const existingState = await ctx.db
                .query('cardStates')
                .withIndex('by_block_direction', (q) =>
                  q.eq('blockId', existingBlock._id).eq('direction', direction),
                )
                .unique()

              if (!existingState) {
                // Create new card state with FSRS defaults
                await createCardState(ctx, existingBlock._id, userId, direction)
              }
            }
          }

          return existingBlock._id
        } else {
          // Create new block
          const id = await ctx.db.insert('blocks', {
            documentId: args.documentId,
            userId,
            nodeId: args.nodeId,
            type: args.type,
            content: args.content,
            textContent: args.textContent,
            position: args.position,
            attrs: args.attrs,
            // Flashcard fields
            isCard: args.isCard,
            cardType: args.cardType,
            cardDirection: args.cardDirection,
            cardFront: args.cardFront,
            cardBack: args.cardBack,
            clozeOcclusions: args.clozeOcclusions,
          })

          // Auto-create card states for new flashcards
          if (args.isCard && args.cardDirection !== 'disabled') {
            const directions = getDirectionsForCard(args.cardDirection)
            for (const direction of directions) {
              await createCardState(ctx, id, userId, direction)
            }
          }

          return id
        }
      },
    )
  },
})

// Delete a block by nodeId
export const deleteBlock = mutation({
  args: {
    documentId: v.id('documents'),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.deleteBlock', op: 'convex.mutation' },
      async () => {
        await requireDocumentAccess(ctx, args.documentId)

        const block = await ctx.db
          .query('blocks')
          .withIndex('by_nodeId', (q) =>
            q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
          )
          .unique()

        if (block) {
          await cascadeDeleteBlock(ctx, block._id)
        }
      },
    )
  },
})

// Delete multiple blocks by nodeIds
export const deleteBlocks = mutation({
  args: {
    documentId: v.id('documents'),
    nodeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.deleteBlocks', op: 'convex.mutation' },
      async () => {
        await requireDocumentAccess(ctx, args.documentId)

        // Batch-fetch all document blocks once
        const existingBlocks = await ctx.db
          .query('blocks')
          .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
          .collect()

        // Create a Map for O(1) lookups by nodeId
        const blocksByNodeId = new Map(
          existingBlocks.map((block) => [block.nodeId, block]),
        )

        // Delete blocks that match the provided nodeIds
        for (const nodeId of args.nodeIds) {
          const block = blocksByNodeId.get(nodeId)
          if (block) {
            await cascadeDeleteBlock(ctx, block._id)
          }
        }
      },
    )
  },
})

// Sync all blocks for a document (batch upsert + delete removed blocks)
export const syncBlocks = mutation({
  args: {
    documentId: v.id('documents'),
    blocks: v.array(
      v.object({
        nodeId: v.string(),
        type: v.string(),
        content: v.any(),
        textContent: v.string(),
        position: v.number(),
        attrs: v.optional(v.any()),
        // Flashcard fields
        isCard: v.optional(v.boolean()),
        cardType: cardTypeValidator,
        cardDirection: cardDirectionValidator,
        cardFront: v.optional(v.string()),
        cardBack: v.optional(v.string()),
        clozeOcclusions: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.syncBlocks', op: 'convex.mutation' },
      async () => {
        const { userId } = await requireDocumentAccess(ctx, args.documentId)

        // Get existing blocks
        const existingBlocks = await ctx.db
          .query('blocks')
          .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
          .collect()

        // Create a Map for O(1) lookups by nodeId
        const existingBlocksByNodeId = new Map(
          existingBlocks.map((block) => [block.nodeId, block]),
        )

        const newNodeIds = new Set(args.blocks.map((b) => b.nodeId))

        // Delete blocks that no longer exist (and their card states)
        for (const block of existingBlocks) {
          if (!newNodeIds.has(block.nodeId)) {
            await cascadeDeleteBlock(ctx, block._id)
          }
        }

        // Upsert all blocks
        for (const block of args.blocks) {
          const existing = existingBlocksByNodeId.get(block.nodeId)

          if (existing) {
            await ctx.db.patch(existing._id, {
              type: block.type,
              content: block.content,
              textContent: block.textContent,
              position: block.position,
              attrs: block.attrs,
              userId, // Ensure userId is set (in case it was missing)
              // Flashcard fields
              isCard: block.isCard,
              cardType: block.cardType,
              cardDirection: block.cardDirection,
              cardFront: block.cardFront,
              cardBack: block.cardBack,
              clozeOcclusions: block.clozeOcclusions,
            })

            // Clean up orphaned card states when direction changes
            await cleanupOrphanedCardStates(
              ctx,
              existing._id,
              block.isCard,
              block.cardDirection,
            )

            // Auto-create/update card states for flashcards
            if (block.isCard && block.cardDirection !== 'disabled') {
              const directions = getDirectionsForCard(block.cardDirection)
              for (const direction of directions) {
                // Check if card state exists
                const existingState = await ctx.db
                  .query('cardStates')
                  .withIndex('by_block_direction', (q) =>
                    q.eq('blockId', existing._id).eq('direction', direction),
                  )
                  .unique()

                if (!existingState) {
                  // Create new card state with FSRS defaults
                  await createCardState(ctx, existing._id, userId, direction)
                }
              }
            }
          } else {
            const blockId = await ctx.db.insert('blocks', {
              documentId: args.documentId,
              userId,
              nodeId: block.nodeId,
              type: block.type,
              content: block.content,
              textContent: block.textContent,
              position: block.position,
              attrs: block.attrs,
              // Flashcard fields
              isCard: block.isCard,
              cardType: block.cardType,
              cardDirection: block.cardDirection,
              cardFront: block.cardFront,
              cardBack: block.cardBack,
              clozeOcclusions: block.clozeOcclusions,
            })

            // Auto-create card states for new flashcards
            if (block.isCard && block.cardDirection !== 'disabled') {
              const directions = getDirectionsForCard(block.cardDirection)
              for (const direction of directions) {
                await createCardState(ctx, blockId, userId, direction)
              }
            }
          }
        }
      },
    )
  },
})

// Get all flashcard blocks for a document (excluding disabled cards)
export const listFlashcards = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.listFlashcards', op: 'convex.query' },
      async () => {
        await requireDocumentAccess(ctx, args.documentId)

        const blocks = await ctx.db
          .query('blocks')
          .withIndex('by_document_isCard', (q) =>
            q.eq('documentId', args.documentId).eq('isCard', true),
          )
          .collect()

        return filterOutDisabledCards(blocks)
      },
    )
  },
})

function filterOutDisabledCards<
  T extends { cardDirection?: string | undefined },
>(blocks: Array<T>): Array<T> {
  return blocks.filter((block) => block.cardDirection !== 'disabled')
}

// Get flashcard count for a document
export const countFlashcards = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.countFlashcards', op: 'convex.query' },
      async () => {
        await requireDocumentAccess(ctx, args.documentId)

        const blocks = await ctx.db
          .query('blocks')
          .withIndex('by_document_isCard', (q) =>
            q.eq('documentId', args.documentId).eq('isCard', true),
          )
          .collect()

        return filterOutDisabledCards(blocks).length
      },
    )
  },
})

// Get all flashcards across all user documents (for study page)
export const listAllFlashcards = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      document: {
        _id: Id<'documents'>
        title: string
      }
      flashcards: Array<Doc<'blocks'>>
    }>
  > => {
    return await Sentry.startSpan(
      { name: 'blocks.listAllFlashcards', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)

        // Get all flashcards for the user in a single query using the optimized index
        const allFlashcardBlocks = await ctx.db
          .query('blocks')
          .withIndex('by_user_isCard', (q) =>
            q.eq('userId', userId).eq('isCard', true),
          )
          .collect()

        const flashcards: Array<Doc<'blocks'>> =
          filterOutDisabledCards(allFlashcardBlocks)

        // Get all user's documents to map flashcards to documents
        const documents = await ctx.db
          .query('documents')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect()

        // Create a map of documentId -> document for quick lookup
        const documentsMap = new Map(documents.map((doc) => [doc._id, doc]))

        // Group flashcards by document
        const flashcardsByDocumentId = new Map<
          Id<'documents'>,
          Array<Doc<'blocks'>>
        >()
        for (const flashcard of flashcards) {
          const docId = flashcard.documentId
          if (!flashcardsByDocumentId.has(docId)) {
            flashcardsByDocumentId.set(docId, [])
          }
          flashcardsByDocumentId.get(docId)!.push(flashcard)
        }

        // Build the result array (avoid nulls so the return type is precise)
        const result: Array<{
          document: {
            _id: Id<'documents'>
            title: string
          }
          flashcards: Array<Doc<'blocks'>>
        }> = []
        for (const [documentId, flashcardList] of flashcardsByDocumentId) {
          if (flashcardList.length === 0) continue
          const document = documentsMap.get(documentId)
          if (!document) continue

          result.push({
            document: {
              _id: document._id,
              title: document.title,
            },
            flashcards: flashcardList,
          })
        }

        return result
      },
    )
  },
})
