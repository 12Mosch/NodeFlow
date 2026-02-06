import { v } from 'convex/values'
import { internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

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
 * Look up a user by their identity subject (WorkOS ID).
 * Shared helper used by getUser, queryDocumentAccess, and checkDocumentAccess
 * to keep the user-fetching logic in one place.
 *
 * @returns The user document, or null if not found
 * @throws On database errors (infrastructure failures should not be swallowed)
 */
export async function getUserByIdentity(
  ctx: QueryCtx | MutationCtx,
  subject: string,
): Promise<Doc<'users'> | null> {
  try {
    return await ctx.db
      .query('users')
      .withIndex('workosId', (q) => q.eq('workosId', subject))
      .unique()
  } catch (error) {
    console.error('Database error while looking up user:', error, { subject })
    throw new Error('Database error while looking up user')
  }
}

/**
 * Returns the authenticated user's ID, or null if not authenticated.
 * Use in queries so they return null instead of throwing during
 * cache restoration or before auth is established.
 */
export async function getUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const user = await getUserByIdentity(ctx, identity.subject)
  return user?._id ?? null
}

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
