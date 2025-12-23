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

  // Individual blocks within documents (for block-level tracking)
  blocks: defineTable({
    documentId: v.id('documents'),
    nodeId: v.string(), // Unique ID per block
    type: v.string(), // 'paragraph', 'heading', 'bulletList', etc.
    content: v.any(), // JSON content of the ProseMirror node
    textContent: v.string(), // Plain text for search/indexing
    position: v.number(), // Order in document
    attrs: v.optional(v.any()), // Node attributes (heading level, etc.)
  })
    .index('by_document', ['documentId'])
    .index('by_document_position', ['documentId', 'position'])
    .index('by_nodeId', ['documentId', 'nodeId']),
})
