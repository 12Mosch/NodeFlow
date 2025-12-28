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
    userId: v.id('users'), // Denormalized for efficient querying (matches document.userId)
    nodeId: v.string(), // Unique ID per block
    type: v.string(), // 'paragraph', 'heading', 'bulletList', etc.
    content: v.any(), // JSON content of the ProseMirror node
    textContent: v.string(), // Plain text for search/indexing
    position: v.number(), // Order in document
    attrs: v.optional(v.any()), // Node attributes (heading level, etc.)
    // Flashcard fields (set when block contains flashcard syntax)
    isCard: v.optional(v.boolean()),
    cardType: v.optional(
      v.union(
        v.literal('basic'),
        v.literal('concept'),
        v.literal('descriptor'),
        v.literal('cloze'),
      ),
    ),
    cardDirection: v.optional(
      v.union(
        v.literal('forward'),
        v.literal('reverse'),
        v.literal('bidirectional'),
        v.literal('disabled'),
      ),
    ),
    cardFront: v.optional(v.string()),
    cardBack: v.optional(v.string()),
    clozeOcclusions: v.optional(v.array(v.string())),
  })
    .index('by_document', ['documentId'])
    .index('by_document_position', ['documentId', 'position'])
    .index('by_nodeId', ['documentId', 'nodeId'])
    .index('by_document_isCard', ['documentId', 'isCard'])
    .index('by_document_cardType', ['documentId', 'cardType'])
    .index('by_user_isCard', ['userId', 'isCard']), // Optimized index for listAllFlashcards

  // Files uploaded to documents (images, attachments, etc.)
  files: defineTable({
    storageId: v.id('_storage'), // Convex storage ID
    documentId: v.id('documents'), // Document this file belongs to
    userId: v.id('users'), // User who uploaded the file
    fileName: v.optional(v.string()), // Original file name
    mimeType: v.optional(v.string()), // MIME type of the file
    createdAt: v.number(),
  })
    .index('by_document', ['documentId'])
    .index('by_user', ['userId'])
    .index('by_storage', ['storageId']),
})
