import { v } from 'convex/values'
import * as Sentry from '@sentry/tanstackstart-react'
import { mutation, query } from './_generated/server'
import { requireDocumentAccess } from './helpers/documentAccess'

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
        await requireDocumentAccess(ctx, args.documentId)

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
            // Flashcard fields
            isCard: args.isCard,
            cardType: args.cardType,
            cardDirection: args.cardDirection,
            cardFront: args.cardFront,
            cardBack: args.cardBack,
            clozeOcclusions: args.clozeOcclusions,
          })
          return existingBlock._id
        } else {
          // Create new block
          const id = await ctx.db.insert('blocks', {
            documentId: args.documentId,
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
          await ctx.db.delete(block._id)
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
            await ctx.db.delete(block._id)
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
        await requireDocumentAccess(ctx, args.documentId)

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

        // Delete blocks that no longer exist
        for (const block of existingBlocks) {
          if (!newNodeIds.has(block.nodeId)) {
            await ctx.db.delete(block._id)
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
              // Flashcard fields
              isCard: block.isCard,
              cardType: block.cardType,
              cardDirection: block.cardDirection,
              cardFront: block.cardFront,
              cardBack: block.cardBack,
              clozeOcclusions: block.clozeOcclusions,
            })
          } else {
            await ctx.db.insert('blocks', {
              documentId: args.documentId,
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
          }
        }
      },
    )
  },
})
