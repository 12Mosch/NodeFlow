import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Not authenticated')
  const user = await ctx.db
    .query('users')
    .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
    .unique()
  if (!user) throw new Error('User not found')
  return user._id
}

async function checkDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  documentId: string,
) {
  const userId = await requireUser(ctx)
  // documentId is a string from prosemirror-sync, convert to Id<'documents'>
  const document = await ctx.db.get(documentId as Id<'documents'>)

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
