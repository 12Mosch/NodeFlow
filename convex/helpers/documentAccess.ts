import { requireUser } from '../auth'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

/**
 * Requires document access. Throws an error if document doesn't exist or
 * user doesn't have access. Used for mutations and queries where failures
 * should be explicit errors.
 *
 * @param ctx - Query or Mutation context
 * @param documentId - The document ID to check access for (string or Id<'documents'>)
 * @returns Object containing the document and userId
 */
export async function requireDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  documentId: string | Id<'documents'>,
) {
  const userId = await requireUser(ctx)

  // Use Convex's built-in normalizeId for ID validation
  const normalizedId = ctx.db.normalizeId('documents', documentId)
  if (!normalizedId) {
    throw new Error('Invalid document ID format')
  }

  const document = await ctx.db.get(normalizedId)

  if (!document || document.userId !== userId) {
    throw new Error('Document not found or access denied')
  }

  return { document, userId }
}

/**
 * Check document access for public or authenticated users.
 * Supports both owner and public access modes.
 *
 * @param ctx - Query or Mutation context
 * @param documentId - The document ID to check access for
 * @param options - Optional parameters (requireWrite: reject read-only public access)
 * @returns Object containing document, access level, and userId (null for public)
 */
export async function checkDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  documentId: string | Id<'documents'>,
  options?: { requireWrite?: boolean },
): Promise<{
  document: Doc<'documents'>
  accessLevel: 'owner' | 'public-view' | 'public-edit'
  userId: Id<'users'> | null
}> {
  const normalizedId = ctx.db.normalizeId('documents', documentId)
  if (!normalizedId) {
    throw new Error('Invalid document ID format')
  }

  const document = await ctx.db.get(normalizedId)
  if (!document) {
    throw new Error('Document not found or access denied')
  }

  // Check for authenticated owner access
  // getUserIdentity() returns null for unauthenticated users, throws for errors
  const identity = await ctx.auth.getUserIdentity()
  if (identity) {
    try {
      const user = await ctx.db
        .query('users')
        .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
        .unique()

      if (user && document.userId === user._id) {
        return { document, accessLevel: 'owner', userId: user._id }
      }
    } catch (error) {
      // Database errors should be logged and rethrown
      console.error('Database error while checking user access:', error, {
        documentId,
        workosId: identity.subject,
      })
      throw new Error('Database error while checking user access')
    }
  }

  // Check public access
  if (document.isPublic) {
    const permission = document.publicPermission ?? 'view'

    if (options?.requireWrite && permission !== 'edit') {
      throw new Error('Write access denied')
    }

    return {
      document,
      accessLevel: permission === 'edit' ? 'public-edit' : 'public-view',
      userId: null,
    }
  }

  throw new Error('Document not found or access denied')
}
