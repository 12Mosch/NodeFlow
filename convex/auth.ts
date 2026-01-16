import { v } from 'convex/values'
import { internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * Internal query to get a user ID by WorkOS subject.
 * Used by actions that don't have direct database access.
 */
export const requireUserInternal = internalQuery({
  args: {
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('workosId', (q) => q.eq('workosId', args.subject))
      .unique()
    if (!user) throw new Error('User not found')
    return user._id
  },
})

/**
 * Requires an authenticated user and returns their user ID.
 * Throws an error if the user is not authenticated or not found.
 * Works with QueryCtx, MutationCtx, and ActionCtx.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Not authenticated')

  // Check if this is an ActionCtx (lacks db property)
  // ActionCtx doesn't have db, while QueryCtx and MutationCtx do
  if (!('db' in ctx)) {
    // Use runQuery for actions
    return await ctx.runQuery(internal.auth.requireUserInternal, {
      subject: identity.subject,
    })
  } else {
    // Use direct db access for queries and mutations
    const user = await ctx.db
      .query('users')
      .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')
    return user._id
  }
}
