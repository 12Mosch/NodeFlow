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

  // Hierarchical blocks for notes
  blocks: defineTable({
    userId: v.id('users'),
    parentId: v.optional(v.id('blocks')),
    content: v.string(),
    type: v.string(), // 'text', 'heading', 'bullet', etc.
    order: v.number(),
    collapsed: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('userId', ['userId'])
    .index('parentId', ['parentId'])
    .index('userParent', ['userId', 'parentId']),
})
