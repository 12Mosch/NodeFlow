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
    text: v.string(), // Content of the block
    isCollapsed: v.boolean(),
    rank: v.number(), // Lexical or simple sorting order
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_parent_rank', ['userId', 'parentId', 'rank']),
})
