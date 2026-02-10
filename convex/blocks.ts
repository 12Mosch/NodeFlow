import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUser } from './auth'
import {
  checkDocumentAccess,
  queryDocumentAccess,
} from './helpers/documentAccess'
import { createNewCardState } from './helpers/fsrs'
import {
  buildAncestorPathByNodeId,
  getCachedAncestorPathFromAttrs,
} from './helpers/flashcardContext'
import type { FlashcardBlockWithAncestorPath } from './helpers/flashcardContext'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type Direction = 'forward' | 'reverse'
// Batch size for deletions to stay under Convex's 16,000 writes/transaction limit
const DELETE_BATCH_SIZE = 500
/**
 * Batch delete IDs using Promise.allSettled to surface failures without aborting.
 * Processes deletions in chunks of DELETE_BATCH_SIZE.
 * Logs any failed deletions to help diagnose orphaned data issues.
 */
async function batchDelete(
  ctx: MutationCtx,
  ids: Array<Id<any>>,
): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + DELETE_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((id) => ctx.db.delete(id)),
    )
    // Log any failed deletions
    const failures = results
      .map((result, index) => ({ result, id: batch[index] }))
      .filter(
        (
          item,
        ): item is {
          result: PromiseRejectedResult
          id: Id<any>
        } => item.result.status === 'rejected',
      )
    if (failures.length > 0) {
      console.error(
        `batchDelete: ${failures.length} deletion(s) failed:`,
        failures.map((f) => ({ id: f.id, reason: f.result.reason })),
      )
    }
  }
}
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
 * For database blocks, also deletes schemas and rows.
 * Uses batched deletions to stay under Convex's 16,000 writes/transaction limit.
 * Deletes in order: reviewLogs → cardStates → databaseSchema → databaseRows → block
 */
async function cascadeDeleteBlock(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
): Promise<void> {
  // Get the block to check its type
  const block = await ctx.db.get(blockId)
  if (!block) {
    return
  }
  // Collect all card states for this block
  const cardStates = await ctx.db
    .query('cardStates')
    .withIndex('by_block_direction', (q) => q.eq('blockId', blockId))
    .collect()
  // Collect all review log IDs for all card states
  const reviewLogIds: Array<Id<'reviewLogs'>> = []
  for (const cardState of cardStates) {
    const logs = await ctx.db
      .query('reviewLogs')
      .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
      .collect()
    reviewLogIds.push(...logs.map((log) => log._id))
  }
  // Batch delete review logs first
  await batchDelete(ctx, reviewLogIds)
  // Batch delete card states
  const cardStateIds = cardStates.map((cs) => cs._id)
  await batchDelete(ctx, cardStateIds)
  // If this is a database block, delete associated schema and rows
  if (block.type === 'database') {
    // Delete schema
    const schema = await ctx.db
      .query('databaseSchemas')
      .withIndex('by_block', (q) => q.eq('blockId', blockId))
      .unique()
    if (schema) {
      await ctx.db.delete(schema._id)
    }
    // Collect and batch delete all rows
    const rows = await ctx.db
      .query('databaseRows')
      .withIndex('by_database', (q) => q.eq('databaseBlockId', blockId))
      .collect()
    const rowIds = rows.map((row) => row._id)
    await batchDelete(ctx, rowIds)
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
 * Uses batched deletions to stay under Convex's 16,000 writes/transaction limit.
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
    // Collect all review log IDs
    const reviewLogIds: Array<Id<'reviewLogs'>> = []
    for (const cardState of allCardStates) {
      const logs = await ctx.db
        .query('reviewLogs')
        .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
        .collect()
      reviewLogIds.push(...logs.map((log) => log._id))
    }
    // Batch delete review logs first
    await batchDelete(ctx, reviewLogIds)
    // Batch delete card states
    const cardStateIds = allCardStates.map((cs) => cs._id)
    await batchDelete(ctx, cardStateIds)
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
  // Find card states to delete (not in needed directions)
  const cardStatesToDelete = existingCardStates.filter(
    (cardState) => !neededDirectionsSet.has(cardState.direction),
  )
  // Collect all review log IDs for card states to delete
  const reviewLogIds: Array<Id<'reviewLogs'>> = []
  for (const cardState of cardStatesToDelete) {
    const logs = await ctx.db
      .query('reviewLogs')
      .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
      .collect()
    reviewLogIds.push(...logs.map((log) => log._id))
  }
  // Batch delete review logs first
  await batchDelete(ctx, reviewLogIds)
  // Batch delete card states
  const cardStateIds = cardStatesToDelete.map((cs) => cs._id)
  await batchDelete(ctx, cardStateIds)
}
function normalizeHeadingTitle(textContent: string): string {
  return textContent.trim()
}
async function syncGhostTitleFromHeadings(
  ctx: MutationCtx,
  documentId: Id<'documents'>,
): Promise<void> {
  const document = await ctx.db.get(documentId)
  if (!document || document.titleMode !== 'auto') return
  let hasInvalidTitleSource = false
  if (document.titleSourceNodeId) {
    const sourceNodeId = document.titleSourceNodeId
    const sourceBlock = await ctx.db
      .query('blocks')
      .withIndex('by_nodeId', (q) =>
        q.eq('documentId', documentId).eq('nodeId', sourceNodeId),
      )
      .unique()
    if (!sourceBlock || sourceBlock.type !== 'heading') {
      hasInvalidTitleSource = true
    } else {
      const nextTitle = normalizeHeadingTitle(sourceBlock.textContent)
      if (!nextTitle) {
        hasInvalidTitleSource = true
      } else if (nextTitle === document.title) {
        return
      } else {
        await ctx.db.patch(documentId, { title: nextTitle })
        return
      }
    }
  }
  const allBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_document_position', (q) => q.eq('documentId', documentId))
    .order('asc')
    .collect()
  const firstHeading = allBlocks.find(
    (block) =>
      block.type === 'heading' &&
      normalizeHeadingTitle(block.textContent).length > 0,
  )
  if (!firstHeading) {
    if (hasInvalidTitleSource) {
      await ctx.db.patch(documentId, { titleSourceNodeId: undefined })
    }
    return
  }
  const nextTitle = normalizeHeadingTitle(firstHeading.textContent)
  const patch: {
    title?: string
    titleSourceNodeId?: string
  } = {
    titleSourceNodeId: firstHeading.nodeId,
  }
  if (nextTitle !== document.title) {
    patch.title = nextTitle
  }
  await ctx.db.patch(documentId, patch)
}
// Get all blocks for a document
export const listByDocument = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Allow public read access; return [] before auth is ready
      const access = await queryDocumentAccess(ctx, args.documentId)
      if (!access) return []
      const blocks = await ctx.db
        .query('blocks')
        .withIndex('by_document_position', (q) =>
          q.eq('documentId', args.documentId),
        )
        .order('asc')
        .collect()
      return blocks
    })()
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
    return await (async () => {
      const { document, userId } = await checkDocumentAccess(
        ctx,
        args.documentId,
        { requireWrite: true },
      )
      // For public edit, use document owner's userId for blocks
      const effectiveUserId: Id<'users'> = userId ?? document.userId
      // Check if block exists
      const existingBlock = await ctx.db
        .query('blocks')
        .withIndex('by_nodeId', (q) =>
          q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
        )
        .unique()
      let blockId: Id<'blocks'>
      if (existingBlock) {
        // Update existing block
        await ctx.db.patch(existingBlock._id, {
          type: args.type,
          content: args.content,
          textContent: args.textContent,
          position: args.position,
          attrs: args.attrs,
          userId: effectiveUserId, // Ensure userId is set (in case it was missing)
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
              await createCardState(
                ctx,
                existingBlock._id,
                effectiveUserId,
                direction,
              )
            }
          }
        }
        blockId = existingBlock._id
      } else {
        // Create new block
        blockId = await ctx.db.insert('blocks', {
          documentId: args.documentId,
          userId: effectiveUserId,
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
            await createCardState(ctx, blockId, effectiveUserId, direction)
          }
        }
      }
      await syncGhostTitleFromHeadings(ctx, args.documentId)
      return blockId
    })()
  },
})
// Delete a block by nodeId
export const deleteBlock = mutation({
  args: {
    documentId: v.id('documents'),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Require write access (owner or public-edit)
      await checkDocumentAccess(ctx, args.documentId, { requireWrite: true })
      const block = await ctx.db
        .query('blocks')
        .withIndex('by_nodeId', (q) =>
          q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
        )
        .unique()
      if (block) {
        await cascadeDeleteBlock(ctx, block._id)
      }
      await syncGhostTitleFromHeadings(ctx, args.documentId)
    })()
  },
})
// Delete multiple blocks by nodeIds
export const deleteBlocks = mutation({
  args: {
    documentId: v.id('documents'),
    nodeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Require write access (owner or public-edit)
      await checkDocumentAccess(ctx, args.documentId, { requireWrite: true })
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
      await syncGhostTitleFromHeadings(ctx, args.documentId)
    })()
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
    return await (async () => {
      const { document, userId } = await checkDocumentAccess(
        ctx,
        args.documentId,
        { requireWrite: true },
      )
      // For public edit, use document owner's userId for blocks
      const effectiveUserId: Id<'users'> = userId ?? document.userId
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
            userId: effectiveUserId, // Ensure userId is set (in case it was missing)
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
                await createCardState(
                  ctx,
                  existing._id,
                  effectiveUserId,
                  direction,
                )
              }
            }
          }
        } else {
          const blockId = await ctx.db.insert('blocks', {
            documentId: args.documentId,
            userId: effectiveUserId,
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
              await createCardState(ctx, blockId, effectiveUserId, direction)
            }
          }
        }
      }
      await syncGhostTitleFromHeadings(ctx, args.documentId)
    })()
  },
})
// Get all flashcard blocks for a document (excluding disabled cards)
export const listFlashcards = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<FlashcardBlockWithAncestorPath>> => {
    return await (async () => {
      // Allow public read access; return [] before auth is ready
      const access = await queryDocumentAccess(ctx, args.documentId)
      if (!access) return []
      const flashcards = filterOutDisabledCards(
        await ctx.db
          .query('blocks')
          .withIndex('by_document_isCard', (q) =>
            q.eq('documentId', args.documentId).eq('isCard', true),
          )
          .collect(),
      )
      const cachedAncestorPathByNodeId = new Map<string, Array<string>>()
      for (const block of flashcards) {
        const cachedAncestorPath = getCachedAncestorPathFromAttrs(block.attrs)
        if (!cachedAncestorPath || cachedAncestorPath.length === 0) continue
        cachedAncestorPathByNodeId.set(block.nodeId, cachedAncestorPath)
      }
      const needsStructuralFallback = flashcards.some(
        (block) => !cachedAncestorPathByNodeId.has(block.nodeId),
      )
      if (!needsStructuralFallback) {
        return flashcards.map((block) => ({
          ...block,
          ancestorPath: cachedAncestorPathByNodeId.get(block.nodeId),
        }))
      }
      const allBlocks = await ctx.db
        .query('blocks')
        .withIndex('by_document_position', (q) =>
          q.eq('documentId', args.documentId),
        )
        .order('asc')
        .collect()
      const ancestorPathByNodeId = buildAncestorPathByNodeId(allBlocks)
      return flashcards.map((block) => ({
        ...block,
        ancestorPath:
          cachedAncestorPathByNodeId.get(block.nodeId) ??
          ancestorPathByNodeId.get(block.nodeId),
      }))
    })()
  },
})
function filterOutDisabledCards<
  T extends {
    cardDirection?: string | undefined
  },
>(blocks: Array<T>): Array<T> {
  return blocks.filter((block) => block.cardDirection !== 'disabled')
}
// Get flashcard count for a document
export const countFlashcards = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Allow public read access; return 0 before auth is ready
      const access = await queryDocumentAccess(ctx, args.documentId)
      if (!access) return 0
      const blocks = await ctx.db
        .query('blocks')
        .withIndex('by_document_isCard', (q) =>
          q.eq('documentId', args.documentId).eq('isCard', true),
        )
        .collect()
      return filterOutDisabledCards(blocks).length
    })()
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
      flashcards: Array<FlashcardBlockWithAncestorPath>
    }>
  > => {
    return await (async () => {
      const userId = await getUser(ctx)
      if (!userId) return []
      // Get all flashcards for the user in a single query using the optimized index
      const allFlashcardBlocks = await ctx.db
        .query('blocks')
        .withIndex('by_user_isCard', (q) =>
          q.eq('userId', userId).eq('isCard', true),
        )
        .collect()
      const flashcards: Array<FlashcardBlockWithAncestorPath> =
        filterOutDisabledCards(allFlashcardBlocks).map((flashcard) => ({
          ...flashcard,
          ancestorPath:
            getCachedAncestorPathFromAttrs(flashcard.attrs) ?? undefined,
        }))
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
        Array<FlashcardBlockWithAncestorPath>
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
        flashcards: Array<FlashcardBlockWithAncestorPath>
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
    })()
  },
})
