import { getUserByIdentity, requireUser } from '../auth'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

/**
 * Query-safe document access check for public or authenticated users.
 * Returns null instead of throwing when access is denied, making it safe
 * for use in queries that may run before auth is established (e.g. during
 * TanStack Query cache restoration).
 *
 * Public document access still works because isPublic is checked before
 * returning null.
 *
 * @param ctx - Query context (not MutationCtx — mutations should use checkDocumentAccess)
 * @param documentId - The document ID to check access for
 * @returns Object containing document, access level, and userId — or null if access denied
 */
export async function queryDocumentAccess(
  ctx: QueryCtx,
  documentId: string | Id<'documents'>,
): Promise<{
  document: Doc<'documents'>
  accessLevel: 'owner' | 'public-view' | 'public-edit'
  userId: Id<'users'> | null
} | null> {
  const normalizedId = ctx.db.normalizeId('documents', documentId)
  if (!normalizedId) {
    return null
  }

  const document = await ctx.db.get(normalizedId)
  if (!document) {
    return null
  }

  // Check for authenticated owner access
  const identity = await ctx.auth.getUserIdentity()
  if (identity) {
    const user = await getUserByIdentity(ctx, identity.subject)
    if (user && document.userId === user._id) {
      return { document, accessLevel: 'owner', userId: user._id }
    }
  }

  // Check public access
  if (document.isPublic) {
    const permission = document.publicPermission ?? 'view'
    return {
      document,
      accessLevel: permission === 'edit' ? 'public-edit' : 'public-view',
      userId: null,
    }
  }

  return null
}

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
  const identity = await ctx.auth.getUserIdentity()
  if (identity) {
    const user = await getUserByIdentity(ctx, identity.subject)
    if (user && document.userId === user._id) {
      return { document, accessLevel: 'owner', userId: user._id }
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
