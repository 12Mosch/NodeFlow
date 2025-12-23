import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { requireUser } from './auth'
import type { MutationCtx, QueryCtx } from './_generated/server'

async function checkDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  documentId: string,
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
