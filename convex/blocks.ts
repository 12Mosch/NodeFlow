import { v } from 'convex/values'
import * as Sentry from '@sentry/tanstackstart-react'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

async function requireUser(ctx: QueryCtx) {
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

export const get = query({
  args: {
    parentId: v.optional(v.id('blocks')),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.get', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)

        // If parentId is provided, get children of that block
        // If not, get root blocks (where parentId is undefined/null)
        const blocks = await ctx.db
          .query('blocks')
          .withIndex('by_user_parent_rank', (q) =>
            q.eq('userId', userId).eq('parentId', args.parentId),
          )
          .collect()

        return blocks
      },
    )
  },
})

export const getOne = query({
  args: {
    id: v.id('blocks'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.getOne', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const block = await ctx.db.get(args.id)

        if (!block || block.userId !== userId) {
          return null
        }

        return block
      },
    )
  },
})

async function getNextRank(
  ctx: QueryCtx,
  userId: Id<'users'>,
  parentId: Id<'blocks'> | undefined,
  afterId?: Id<'blocks'>,
  providedRank?: number,
) {
  if (providedRank !== undefined) return providedRank

  if (afterId) {
    const afterBlock = await ctx.db.get(afterId)
    if (afterBlock) {
      const nextBlock = await ctx.db
        .query('blocks')
        .withIndex('by_user_parent_rank', (q) =>
          q
            .eq('userId', userId)
            .eq('parentId', parentId)
            .gt('rank', afterBlock.rank),
        )
        .first()

      if (nextBlock) {
        return (afterBlock.rank + nextBlock.rank) / 2
      } else {
        return afterBlock.rank + 1
      }
    }
  }

  const lastBlock = await ctx.db
    .query('blocks')
    .withIndex('by_user_parent_rank', (q) =>
      q.eq('userId', userId).eq('parentId', parentId),
    )
    .order('desc')
    .first()
  return (lastBlock?.rank ?? 0) + 1
}

export const create = mutation({
  args: {
    parentId: v.optional(v.id('blocks')),
    text: v.string(),
    rank: v.optional(v.number()),
    afterId: v.optional(v.id('blocks')),
    isCollapsed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.create', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        if (args.parentId) {
          const parent = await ctx.db.get(args.parentId)
          if (!parent || parent.userId !== userId) {
            throw new Error('Parent block not found or access denied')
          }
        }

        const rank = await getNextRank(
          ctx,
          userId,
          args.parentId,
          args.afterId,
          args.rank,
        )

        return await ctx.db.insert('blocks', {
          userId,
          parentId: args.parentId,
          text: args.text,
          rank: rank,
          isCollapsed: args.isCollapsed ?? false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      },
    )
  },
})

export const update = mutation({
  args: {
    id: v.id('blocks'),
    text: v.optional(v.string()),
    isCollapsed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.update', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const block = await ctx.db.get(args.id)

        if (!block || block.userId !== userId) {
          throw new Error('Block not found or access denied')
        }

        await ctx.db.patch(args.id, {
          ...(args.text !== undefined && { text: args.text }),
          ...(args.isCollapsed !== undefined && {
            isCollapsed: args.isCollapsed,
          }),
          updatedAt: Date.now(),
        })
      },
    )
  },
})

export const move = mutation({
  args: {
    id: v.id('blocks'),
    parentId: v.optional(v.id('blocks')),
    rank: v.optional(v.number()),
    afterId: v.optional(v.id('blocks')),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.move', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const block = await ctx.db.get(args.id)

        if (!block || block.userId !== userId) {
          throw new Error('Block not found or access denied')
        }

        if (args.parentId) {
          if (args.parentId === args.id) {
            throw new Error('Cannot move block into itself')
          }

          const parent = await ctx.db.get(args.parentId)
          if (!parent || parent.userId !== userId) {
            throw new Error('Parent block not found or access denied')
          }

          // Check for cycles: ensure new parent is not a descendant of the block being moved
          let ancestorId = parent.parentId
          while (ancestorId) {
            if (ancestorId === args.id) {
              throw new Error('Cannot move block into its own descendant')
            }
            const ancestor = await ctx.db.get(ancestorId)
            if (!ancestor) break
            ancestorId = ancestor.parentId
          }
        }

        const rank = await getNextRank(
          ctx,
          userId,
          args.parentId,
          args.afterId,
          args.rank,
        )

        await ctx.db.patch(args.id, {
          parentId: args.parentId,
          rank: rank,
          updatedAt: Date.now(),
        })
      },
    )
  },
})

export const deleteBlock = mutation({
  args: {
    id: v.id('blocks'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'blocks.deleteBlock', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const block = await ctx.db.get(args.id)

        if (!block || block.userId !== userId) {
          throw new Error('Block not found or access denied')
        }

        // Recursive delete helper
        async function deleteRecursive(id: Id<'blocks'>) {
          // Find children
          const children = await ctx.db
            .query('blocks')
            .withIndex('by_user_parent_rank', (q) =>
              q.eq('userId', userId).eq('parentId', id),
            )
            .collect()

          for (const child of children) {
            await deleteRecursive(child._id)
          }

          await ctx.db.delete(id)
        }

        await deleteRecursive(args.id)
      },
    )
  },
})
