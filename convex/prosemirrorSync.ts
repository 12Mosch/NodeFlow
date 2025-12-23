import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { requireUser } from './auth'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * Validates that a string is a valid Convex ID format.
 * Convex IDs start with a letter and contain only alphanumeric characters.
 */
function isValidConvexId(id: string): boolean {
  // Convex IDs start with a letter and contain only alphanumeric characters
  return /^[a-z][a-z0-9]*$/i.test(id) && id.length >= 1
}

async function checkDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  documentId: string,
) {
  const userId = await requireUser(ctx)

  // Validate documentId format before casting
  if (!isValidConvexId(documentId)) {
    throw new Error('Invalid document ID format')
  }

  // documentId is a string from prosemirror-sync, convert to Id<'documents'>
  let document
  try {
    document = await ctx.db.get(documentId as Id<'documents'>)
  } catch (error) {
    throw new Error('Invalid document ID format')
  }

  if (!document || document.userId !== userId) {
    throw new Error('Document not found or access denied')
  }
}

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync)

// Export the sync functions for use in the frontend
export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  checkRead: async (ctx: QueryCtx, documentId: string) => {
    await checkDocumentAccess(ctx, documentId)
  },
  checkWrite: async (ctx: MutationCtx, documentId: string) => {
    await checkDocumentAccess(ctx, documentId)
  },
})
