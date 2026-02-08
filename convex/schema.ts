import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Users created on first authenticated request
  users: defineTable({
    workosId: v.string(), // WorkOS user ID from JWT
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    presenceColor: v.optional(v.string()), // Consistent color for presence indicators
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('workosId', ['workosId'])
    .index('email', ['email']),

  // Rich text documents with Tiptap/ProseMirror
  documents: defineTable({
    userId: v.id('users'),
    title: v.string(),
    titleMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
    titleSourceNodeId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Sharing fields
    isPublic: v.optional(v.boolean()),
    publicSlug: v.optional(v.string()),
    publicPermission: v.optional(v.union(v.literal('view'), v.literal('edit'))),
  })
    .index('by_user', ['userId'])
    .index('by_user_updated', ['userId', 'updatedAt'])
    .index('by_public_slug', ['publicSlug'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId'],
    }),

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
    .index('by_user', ['userId']) // Optimized index for fetching all user blocks
    .index('by_user_isCard', ['userId', 'isCard']) // Optimized index for listAllFlashcards
    .searchIndex('search_textContent', {
      searchField: 'textContent',
      filterFields: ['userId'],
    }),

  // FSRS card states - tracks spaced repetition memory state per card
  cardStates: defineTable({
    blockId: v.id('blocks'), // Reference to the flashcard block
    userId: v.id('users'), // Card owner (denormalized for efficient querying)
    // For bidirectional cards, we track forward and reverse separately
    direction: v.union(v.literal('forward'), v.literal('reverse')),
    // FSRS memory state
    stability: v.number(), // Time (in days) for retrievability to drop to 90%
    difficulty: v.number(), // Card difficulty (1-10)
    due: v.number(), // Next review timestamp (ms since epoch)
    lastReview: v.optional(v.number()), // Last review timestamp (ms since epoch)
    reps: v.number(), // Total successful review count
    lapses: v.number(), // Times forgotten (pressed Again)
    // Card learning state
    state: v.union(
      v.literal('new'), // Never reviewed
      v.literal('learning'), // In initial learning phase
      v.literal('review'), // Graduated to review queue
      v.literal('relearning'), // Failed review, relearning
    ),
    // For learning/relearning steps
    scheduledDays: v.number(), // Days until next review
    elapsedDays: v.number(), // Days since last review
    // Leech management
    suspended: v.optional(v.boolean()), // Default false - card hidden from reviews
    suspendedAt: v.optional(v.number()), // Suspension timestamp (ms since epoch)
  })
    .index('by_block_direction', ['blockId', 'direction'])
    .index('by_user_due', ['userId', 'due'])
    .index('by_user_due_suspended', ['userId', 'suspended', 'due'])
    .index('by_user_state', ['userId', 'state'])
    .index('by_user_state_due', ['userId', 'state', 'due'])
    .index('by_user_state_suspended', ['userId', 'state', 'suspended'])
    .index('by_user_suspended', ['userId', 'suspended']),

  // Review logs - audit trail of all reviews for analytics
  reviewLogs: defineTable({
    cardStateId: v.id('cardStates'), // Reference to the card state
    userId: v.id('users'), // User who reviewed
    rating: v.number(), // User rating (1=Again, 2=Hard, 3=Good, 4=Easy)
    // State before review
    state: v.union(
      v.literal('new'),
      v.literal('learning'),
      v.literal('review'),
      v.literal('relearning'),
    ),
    // Scheduling info
    scheduledDays: v.number(), // Days that were scheduled
    elapsedDays: v.number(), // Actual days elapsed since last review
    // Memory state at time of review
    stability: v.number(),
    difficulty: v.number(),
    // Timestamp
    reviewedAt: v.number(), // When the review happened (ms since epoch)
  })
    .index('by_cardState', ['cardStateId'])
    .index('by_user_date', ['userId', 'reviewedAt']),

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

  // Database block schemas (column definitions)
  databaseSchemas: defineTable({
    blockId: v.id('blocks'),
    documentId: v.id('documents'),
    userId: v.id('users'),
    columns: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.union(
          v.literal('text'),
          v.literal('number'),
          v.literal('select'),
          v.literal('date'),
        ),
        options: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
              color: v.optional(v.string()),
            }),
          ),
        ),
        width: v.optional(v.number()),
      }),
    ),
    // Persisted view configuration
    filters: v.optional(
      v.array(
        v.object({
          columnId: v.string(),
          operator: v.string(), // 'equals', 'contains', 'gt', 'lt', 'isEmpty', etc.
          value: v.any(),
        }),
      ),
    ),
    sort: v.optional(
      v.object({
        columnId: v.string(),
        direction: v.union(v.literal('asc'), v.literal('desc')),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_block', ['blockId'])
    .index('by_document', ['documentId']),

  // Database block rows
  databaseRows: defineTable({
    databaseBlockId: v.id('blocks'),
    documentId: v.id('documents'),
    userId: v.id('users'),
    position: v.number(),
    cells: v.any(), // { columnId: value }
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_database', ['databaseBlockId'])
    .index('by_database_position', ['databaseBlockId', 'position'])
    .index('by_document', ['documentId']),

  // Real-time presence for collaborative editing
  presence: defineTable({
    documentId: v.id('documents'),
    userId: v.optional(v.id('users')), // null for anonymous users
    sessionId: v.string(), // unique per browser tab
    // Denormalized user info for efficient rendering
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    color: v.string(),
    isAnonymous: v.boolean(),
    // Cursor state
    cursorPosition: v.optional(v.number()),
    selectionFrom: v.optional(v.number()),
    selectionTo: v.optional(v.number()),
    // Activity
    lastSeenAt: v.number(),
    isActive: v.boolean(),
  })
    .index('by_document', ['documentId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_lastSeenAt', ['lastSeenAt']),
})
