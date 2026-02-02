import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'
import type { QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * Gets a document with access check. Returns null if document doesn't exist
 * or user doesn't have access. Used for queries where returning null is
 * acceptable (e.g., for graceful UI handling).
 */
async function getDocumentWithAccess(
  ctx: QueryCtx,
  documentId: Id<'documents'>,
) {
  const userId = await requireUser(ctx)
  const document = await ctx.db.get(documentId)

  if (!document || document.userId !== userId) {
    return null
  }

  return document
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)

    const documents = await ctx.db
      .query('documents')
      .withIndex('by_user_updated', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate(args.paginationOpts)

    return documents
  },
})

export const get = query({
  args: {
    id: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await getDocumentWithAccess(ctx, args.id)
  },
})

export const getPublic = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query('documents')
      .withIndex('by_public_slug', (q) => q.eq('publicSlug', args.slug))
      .unique()

    if (!document || !document.isPublic) {
      return null
    }

    return {
      _id: document._id,
      title: document.title,
      permission: document.publicPermission ?? 'view',
    }
  },
})

export const create = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const now = Date.now()

    const id = await ctx.db.insert('documents', {
      userId,
      title: args.title ?? 'Untitled',
      createdAt: now,
      updatedAt: now,
    })

    return id
  },
})

export const updateTitle = mutation({
  args: {
    id: v.id('documents'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireDocumentAccess(ctx, args.id)

    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    })
  },
})

export const deleteDocument = mutation({
  args: {
    id: v.id('documents'),
  },
  handler: async (ctx, args) => {
    await requireDocumentAccess(ctx, args.id)

    // Query for all files, blocks, and exam links associated with this document
    const files = await ctx.db
      .query('files')
      .withIndex('by_document', (q) => q.eq('documentId', args.id))
      .collect()

    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_document', (q) => q.eq('documentId', args.id))
      .collect()

    // Get exam document links to clean up
    const examDocLinks = await ctx.db
      .query('examDocuments')
      .withIndex('by_document', (q) => q.eq('documentId', args.id))
      .collect()

    // Delete all database records first (files, blocks, exam links, document)
    // This ensures that if any database operation fails, the transaction
    // rolls back and we never delete storage files, preventing broken references
    for (const file of files) {
      await ctx.db.delete(file._id)
    }

    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    // Clean up exam document links
    for (const examDocLink of examDocLinks) {
      await ctx.db.delete(examDocLink._id)
    }

    await ctx.db.delete(args.id)

    // Delete storage files in parallel after all database operations succeed
    // If storage deletion fails, we'll have orphaned storage but no dangling DB reference
    // This is acceptable since the database records are already deleted
    const storageDeletionResults = await Promise.allSettled(
      files.map((file) => ctx.storage.delete(file.storageId)),
    )

    // Log any failures for monitoring
    const failures = storageDeletionResults
      .map((result, index) => ({ result, file: files[index] }))
      .filter(({ result }) => result.status === 'rejected')

    for (const { result, file } of failures) {
      const error = result.status === 'rejected' ? result.reason : undefined
      console.error('Failed to delete file from storage:', error, {
        fileId: file._id,
        documentId: args.id,
      })
    }

    if (failures.length > 0) {
      console.warn(
        `Failed to delete ${failures.length} of ${files.length} storage files`,
      )
    }
  },
})
