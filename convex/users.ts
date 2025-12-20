import { mutation, query } from './_generated/server'

export const getOrCreateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const workosId = identity.subject
    const existing = await ctx.db
      .query('users')
      .withIndex('workosId', (q) => q.eq('workosId', workosId))
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert('users', {
      workosId,
      email: identity.email ?? '',
      name: identity.name ?? undefined,
      avatarUrl: identity.pictureUrl ?? undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query('users')
      .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
      .unique()
  },
})
