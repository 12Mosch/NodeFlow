import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { checkDocumentAccess } from './helpers/documentAccess'
import type { Id } from './_generated/dataModel'
// Batch size for row updates to avoid exceeding Convex mutation limits
const ROW_UPDATE_BATCH_SIZE = 500
// Helper to split an array into chunks of a given size
function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
// Validators for column schema
const selectOptionValidator = v.object({
  id: v.string(),
  label: v.string(),
  color: v.optional(v.string()),
})
const columnValidator = v.object({
  id: v.string(),
  name: v.string(),
  type: v.union(
    v.literal('text'),
    v.literal('number'),
    v.literal('select'),
    v.literal('date'),
  ),
  options: v.optional(v.array(selectOptionValidator)),
  width: v.optional(v.number()),
})
const filterValidator = v.object({
  columnId: v.string(),
  operator: v.string(),
  value: v.union(v.string(), v.number(), v.null(), v.boolean()),
})
const sortValidator = v.object({
  columnId: v.string(),
  direction: v.union(v.literal('asc'), v.literal('desc')),
})
// Get schema by nodeId and documentId
export const getByBlockId = query({
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
      if (!block) return null
      return await ctx.db
        .query('databaseSchemas')
        .withIndex('by_block', (q) => q.eq('blockId', block._id))
        .unique()
    })()
  },
})
// Create a new schema for a database block
export const create = mutation({
  args: {
    nodeId: v.string(),
    documentId: v.id('documents'),
    columns: v.array(columnValidator),
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
        throw new Error('Block not found')
      }
      if (block.type !== 'database') {
        throw new Error('Block is not a database block')
      }
      // Check if schema already exists
      const existing = await ctx.db
        .query('databaseSchemas')
        .withIndex('by_block', (q) => q.eq('blockId', block._id))
        .unique()
      if (existing) {
        throw new Error('Schema already exists for this block')
      }
      const now = Date.now()
      const effectiveUserId: Id<'users'> = userId ?? document.userId
      return await ctx.db.insert('databaseSchemas', {
        blockId: block._id,
        documentId: args.documentId,
        userId: effectiveUserId,
        columns: args.columns,
        createdAt: now,
        updatedAt: now,
      })
    })()
  },
})
// Update schema (columns, filters, sort)
export const update = mutation({
  args: {
    schemaId: v.id('databaseSchemas'),
    columns: v.optional(v.array(columnValidator)),
    filters: v.optional(v.array(filterValidator)),
    sort: v.optional(v.union(sortValidator, v.null())),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const schema = await ctx.db.get(args.schemaId)
      if (!schema) {
        throw new Error('Schema not found')
      }
      // Check document access
      await checkDocumentAccess(ctx, schema.documentId, {
        requireWrite: true,
      })
      const updates: Record<string, unknown> = {
        updatedAt: Date.now(),
      }
      if (args.columns !== undefined) {
        updates.columns = args.columns
      }
      if (args.filters !== undefined) {
        updates.filters = args.filters
      }
      if (args.sort !== undefined) {
        updates.sort = args.sort ?? undefined
      }
      await ctx.db.patch(args.schemaId, updates)
    })()
  },
})
// Add a column to the schema
export const addColumn = mutation({
  args: {
    schemaId: v.id('databaseSchemas'),
    column: columnValidator,
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const schema = await ctx.db.get(args.schemaId)
      if (!schema) {
        throw new Error('Schema not found')
      }
      await checkDocumentAccess(ctx, schema.documentId, {
        requireWrite: true,
      })
      // Check for duplicate column ID
      if (schema.columns.some((c) => c.id === args.column.id)) {
        throw new Error(`Column with id "${args.column.id}" already exists`)
      }
      await ctx.db.patch(args.schemaId, {
        columns: [...schema.columns, args.column],
        updatedAt: Date.now(),
      })
    })()
  },
})
// Delete a column from the schema
export const deleteColumn = mutation({
  args: {
    schemaId: v.id('databaseSchemas'),
    columnId: v.string(),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const schema = await ctx.db.get(args.schemaId)
      if (!schema) {
        throw new Error('Schema not found')
      }
      await checkDocumentAccess(ctx, schema.documentId, {
        requireWrite: true,
      })
      // Remove column from schema
      const newColumns = schema.columns.filter((c) => c.id !== args.columnId)
      // Remove filters and sort that reference this column
      const newFilters = schema.filters?.filter(
        (f) => f.columnId !== args.columnId,
      )
      const newSort =
        schema.sort?.columnId === args.columnId ? undefined : schema.sort
      await ctx.db.patch(args.schemaId, {
        columns: newColumns,
        filters: newFilters,
        sort: newSort,
        updatedAt: Date.now(),
      })
      // Also clean up cell data from rows
      const rows = await ctx.db
        .query('databaseRows')
        .withIndex('by_database', (q) =>
          q.eq('databaseBlockId', schema.blockId),
        )
        .collect()
      // Filter to rows that have the column
      const rowsToUpdate = rows.filter(
        (row) => row.cells && args.columnId in row.cells,
      )
      // Process rows in batches to avoid exceeding Convex write limits
      for (const batch of chunk(rowsToUpdate, ROW_UPDATE_BATCH_SIZE)) {
        await Promise.all(
          batch.map((row) => {
            const { [args.columnId]: _, ...remainingCells } =
              row.cells as Record<string, unknown>
            return ctx.db.patch(row._id, { cells: remainingCells })
          }),
        )
      }
    })()
  },
})
// Update column properties
export const updateColumn = mutation({
  args: {
    schemaId: v.id('databaseSchemas'),
    columnId: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      type: v.optional(
        v.union(
          v.literal('text'),
          v.literal('number'),
          v.literal('select'),
          v.literal('date'),
        ),
      ),
      options: v.optional(v.array(selectOptionValidator)),
      width: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return await (async () => {
      const schema = await ctx.db.get(args.schemaId)
      if (!schema) {
        throw new Error('Schema not found')
      }
      await checkDocumentAccess(ctx, schema.documentId, {
        requireWrite: true,
      })
      // Verify column exists
      if (!schema.columns.some((c) => c.id === args.columnId)) {
        throw new Error(`Column with id "${args.columnId}" not found`)
      }
      const newColumns = schema.columns.map((col) => {
        if (col.id === args.columnId) {
          return { ...col, ...args.updates }
        }
        return col
      })
      await ctx.db.patch(args.schemaId, {
        columns: newColumns,
        updatedAt: Date.now(),
      })
    })()
  },
})
