import { requireUser } from '../auth'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

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
