import * as Sentry from '@sentry/tanstackstart-react'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * Requires an authenticated user and returns their user ID.
 * Throws an error if the user is not authenticated or not found.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<'users'>> {
  return await Sentry.startSpan(
    { name: 'requireUser', op: 'function' },
    async () => {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) throw new Error('Not authenticated')
      const user = await ctx.db
        .query('users')
        .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
        .unique()
      if (!user) throw new Error('User not found')
      return user._id
    },
  )
}
