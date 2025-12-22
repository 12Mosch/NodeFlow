import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users created on first authenticated request
  users: defineTable({
    workosId: v.string(), // WorkOS user ID from JWT
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('workosId', ['workosId'])
    .index('email', ['email']),

  // Rich text documents with Tiptap/ProseMirror
  documents: defineTable({
    userId: v.id('users'),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_updated', ['userId', 'updatedAt']),
})
