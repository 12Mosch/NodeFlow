import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'

/**
 * Toggle public sharing on/off for a document.
 * Generates a unique slug on first enable.
 */
export const toggleSharing = mutation({
  args: {
    documentId: v.id('documents'),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccess(ctx, args.documentId)

    const updates: {
      isPublic: boolean
      updatedAt: number
      publicSlug?: string
      publicPermission?: 'view' | 'edit'
    } = {
      isPublic: args.isPublic,
      updatedAt: Date.now(),
    }

    // Generate slug on first enable (if not already set)
    if (args.isPublic && !document.publicSlug) {
      updates.publicSlug = crypto.randomUUID()
      updates.publicPermission = 'view' // Default to view-only
    }

    await ctx.db.patch(args.documentId, updates)
    return { publicSlug: updates.publicSlug ?? document.publicSlug }
  },
})

/**
 * Update the public permission level for a shared document.
 * Requires that sharing is already enabled (isPublic is true).
 */
export const updatePublicPermission = mutation({
  args: {
    documentId: v.id('documents'),
    permission: v.union(v.literal('view'), v.literal('edit')),
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccess(ctx, args.documentId)

    // Validate that sharing is enabled before updating permission
    if (!document.isPublic) {
      throw new Error(
        'Cannot update permission: sharing is not enabled for this document',
      )
    }

    await ctx.db.patch(args.documentId, {
      publicPermission: args.permission,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Regenerate the public slug (invalidates old links).
 * Requires that sharing is already enabled (isPublic is true).
 */
export const regeneratePublicSlug = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccess(ctx, args.documentId)

    // Validate that sharing is enabled before regenerating slug
    if (!document.isPublic) {
      throw new Error(
        'Cannot regenerate link: sharing is not enabled for this document',
      )
    }

    const newSlug = crypto.randomUUID()
    await ctx.db.patch(args.documentId, {
      publicSlug: newSlug,
      updatedAt: Date.now(),
    })
    return { publicSlug: newSlug }
  },
})

/**
 * Get sharing settings for a document (owner only).
 */
export const getSharingSettings = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const userId = await getUser(ctx)
    if (!userId) return null

    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== userId) return null

    return {
      isPublic: document.isPublic ?? false,
      publicSlug: document.publicSlug,
      publicPermission: document.publicPermission ?? 'view',
    }
  },
})
