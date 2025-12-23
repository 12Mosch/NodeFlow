import { ProsemirrorSync } from '@convex-dev/prosemirror-sync'
import { components } from './_generated/api'
import { requireDocumentAccess } from './helpers/documentAccess'
import type { MutationCtx, QueryCtx } from './_generated/server'

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
    await requireDocumentAccess(ctx, documentId)
  },
  checkWrite: async (ctx: MutationCtx, documentId: string) => {
    await requireDocumentAccess(ctx, documentId)
  },
})
