import { v } from 'convex/values'
import * as Sentry from '@sentry/tanstackstart-react'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'documents.list', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)

        const documents = await ctx.db
          .query('documents')
          .withIndex('by_user_updated', (q) => q.eq('userId', userId))
          .order('desc')
          .collect()

        return documents
      },
    )
  },
})

export const get = query({
  args: {
    id: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'documents.get', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const document = await ctx.db.get(args.id)

        if (!document || document.userId !== userId) {
          return null
        }

        return document
      },
    )
  },
})

export const create = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'documents.create', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        const id = await ctx.db.insert('documents', {
          userId,
          title: args.title ?? 'Untitled',
          createdAt: now,
          updatedAt: now,
        })

        return id
      },
    )
  },
})

export const updateTitle = mutation({
  args: {
    id: v.id('documents'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'documents.updateTitle', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const document = await ctx.db.get(args.id)

        if (!document || document.userId !== userId) {
          throw new Error('Document not found or access denied')
        }

        await ctx.db.patch(args.id, {
          title: args.title,
          updatedAt: Date.now(),
        })
      },
    )
  },
})

export const deleteDocument = mutation({
  args: {
    id: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'documents.deleteDocument', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const document = await ctx.db.get(args.id)

        if (!document || document.userId !== userId) {
          throw new Error('Document not found or access denied')
        }

        await ctx.db.delete(args.id)
      },
    )
  },
})
