import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { checkDocumentAccess } from './helpers/documentAccess'
import type { Id } from './_generated/dataModel'
// List all rows for a database block
export const listByDatabase = query({
  args: { nodeId: v.string(), documentId: v.id('documents') },
  handler: async (ctx, args) => {
    return await (async () => {
      // Check document access
      await checkDocumentAccess(ctx, args.documentId)
      // Look up the block by nodeId
      const block = await ctx.db
        .query('blocks')
        .withIndex('by_nodeId', (q) =>
          q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
        )
        .unique()
      if (!block) return []
      return await ctx.db
        .query('databaseRows')
        .withIndex('by_database_position', (q) =>
          q.eq('databaseBlockId', block._id),
        )
        .order('asc')
        .collect()
    })()
  },
})
// Create a new row
export const create = mutation({
  args: {
    nodeId: v.string(),
    documentId: v.id('documents'),
    cells: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Check document access
      const { userId, document } = await checkDocumentAccess(
        ctx,
        args.documentId,
        {
          requireWrite: true,
        },
      )
      // Look up the block by nodeId
      const block = await ctx.db
        .query('blocks')
        .withIndex('by_nodeId', (q) =>
          q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
        )
        .unique()
      if (!block) {
        throw new Error('Database block not found')
      }
      if (block.type !== 'database') {
        throw new Error('Target block is not a database block')
      }
      // Get max position by fetching only the row with highest position
      const lastRow = await ctx.db
        .query('databaseRows')
        .withIndex('by_database_position', (q) =>
          q.eq('databaseBlockId', block._id),
        )
        .order('desc')
        .first()
      const maxPosition = lastRow?.position ?? -1
      const now = Date.now()
      const effectiveUserId: Id<'users'> = userId ?? document.userId
      return await ctx.db.insert('databaseRows', {
        databaseBlockId: block._id,
        documentId: args.documentId,
        userId: effectiveUserId,
        position: maxPosition + 1,
        cells: args.cells ?? {},
        createdAt: now,
        updatedAt: now,
      })
    })()
  },
})
// Update a cell value
export const updateCell = mutation({
  args: {
    rowId: v.id('databaseRows'),
    columnId: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const row = await ctx.db.get(args.rowId)
      if (!row) {
        throw new Error('Row not found')
      }
      await checkDocumentAccess(ctx, row.documentId, { requireWrite: true })
      const cells = (row.cells ?? {}) as Record<string, unknown>
      await ctx.db.patch(args.rowId, {
        cells: { ...cells, [args.columnId]: args.value },
        updatedAt: Date.now(),
      })
    })()
  },
})
// Update multiple cells in a row at once
export const updateCells = mutation({
  args: {
    rowId: v.id('databaseRows'),
    cells: v.any(),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const row = await ctx.db.get(args.rowId)
      if (!row) {
        throw new Error('Row not found')
      }
      await checkDocumentAccess(ctx, row.documentId, { requireWrite: true })
      const existingCells = (row.cells ?? {}) as Record<string, unknown>
      const newCells = args.cells as Record<string, unknown>
      await ctx.db.patch(args.rowId, {
        cells: { ...existingCells, ...newCells },
        updatedAt: Date.now(),
      })
    })()
  },
})
// Delete a row
export const delete_ = mutation({
  args: { rowId: v.id('databaseRows') },
  handler: async (ctx, args) => {
    return await (async () => {
      const row = await ctx.db.get(args.rowId)
      if (!row) {
        throw new Error('Row not found')
      }
      await checkDocumentAccess(ctx, row.documentId, { requireWrite: true })
      await ctx.db.delete(args.rowId)
    })()
  },
})
// Reorder rows
export const reorder = mutation({
  args: {
    nodeId: v.string(),
    documentId: v.id('documents'),
    rowIds: v.array(v.id('databaseRows')),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      // Check document access
      await checkDocumentAccess(ctx, args.documentId, { requireWrite: true })
      // Look up the block by nodeId (for validation)
      const block = await ctx.db
        .query('blocks')
        .withIndex('by_nodeId', (q) =>
          q.eq('documentId', args.documentId).eq('nodeId', args.nodeId),
        )
        .unique()
      if (!block) {
        throw new Error('Database block not found')
      }
      if (block.type !== 'database') {
        throw new Error('Target block is not a database block')
      }
      // Fetch all rows and validate ownership before applying any patches
      const rows = await Promise.all(
        args.rowIds.map((rowId) => ctx.db.get(rowId)),
      )
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row) {
          throw new Error(`Row not found: ${args.rowIds[i]}`)
        }
        if (row.databaseBlockId !== block._id) {
          throw new Error(
            `Row ${args.rowIds[i]} does not belong to database block ${block._id}`,
          )
        }
      }
      // Update positions based on new order using a single timestamp
      const now = Date.now()
      await Promise.all(
        args.rowIds.map((rowId, i) =>
          ctx.db.patch(rowId, {
            position: i,
            updatedAt: now,
          }),
        ),
      )
    })()
  },
})
