import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { checkDocumentAccess } from './helpers/documentAccess'

// Stale threshold: 30 seconds for filtering active users in queries
const STALE_THRESHOLD_MS = 30 * 1000
// Cleanup threshold: 60 seconds for removing old records
const CLEANUP_THRESHOLD_MS = 60 * 1000

/**
 * Update presence for a user in a document.
 * Handles both authenticated and anonymous users.
 */
export const updatePresence = mutation({
  args: {
    documentId: v.id('documents'),
    sessionId: v.string(),
    cursorPosition: v.optional(v.number()),
    selectionFrom: v.optional(v.number()),
    selectionTo: v.optional(v.number()),
    // For anonymous users, we pass name and color from the client
    name: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Check document access (allows both authenticated and public access)
    const { document, userId } = await checkDocumentAccess(ctx, args.documentId)

    // Get user info if authenticated
    let userName: string | undefined
    let avatarUrl: string | undefined
    let presenceColor = args.color
    const isAnonymous = userId === null

    if (userId) {
      const user = await ctx.db.get(userId)
      if (user) {
        userName = user.name
        avatarUrl = user.avatarUrl
        // Use stored presence color if available, otherwise use provided color
        if (user.presenceColor) {
          presenceColor = user.presenceColor
        } else {
          // Store the color for consistent future use
          await ctx.db.patch(userId, { presenceColor: args.color })
        }
      }
    } else {
      // Use provided name for anonymous users
      userName = args.name ?? 'Anonymous'
    }

    const now = Date.now()

    // Check if presence record already exists for this session
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .unique()

    if (existing) {
      // Verify the record belongs to the same document
      if (existing.documentId !== document._id) {
        // User switched documents - remove old presence and create new
        await ctx.db.delete(existing._id)
      } else {
        // Update existing presence
        await ctx.db.patch(existing._id, {
          cursorPosition: args.cursorPosition,
          selectionFrom: args.selectionFrom,
          selectionTo: args.selectionTo,
          lastSeenAt: now,
          isActive: true,
          // Update user info in case it changed
          name: userName,
          avatarUrl,
          color: presenceColor,
        })
        return existing._id
      }
    }

    // Create new presence record
    return await ctx.db.insert('presence', {
      documentId: document._id,
      userId: userId ?? undefined,
      sessionId: args.sessionId,
      name: userName,
      avatarUrl,
      color: presenceColor,
      isAnonymous,
      cursorPosition: args.cursorPosition,
      selectionFrom: args.selectionFrom,
      selectionTo: args.selectionTo,
      lastSeenAt: now,
      isActive: true,
    })
  },
})

/**
 * Get active presence records for a document.
 * Filters out stale records (>30 seconds since last update).
 */
export const getDocumentPresence = query({
  args: {
    documentId: v.id('documents'),
    excludeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check document access
    await checkDocumentAccess(ctx, args.documentId)

    const now = Date.now()
    const threshold = now - STALE_THRESHOLD_MS

    const presenceRecords = await ctx.db
      .query('presence')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .collect()

    // Filter active records and optionally exclude current session
    const activeRecords = presenceRecords.filter((record) => {
      if (record.lastSeenAt < threshold) return false
      if (!record.isActive) return false
      if (args.excludeSessionId && record.sessionId === args.excludeSessionId) {
        return false
      }
      return true
    })

    // Omit sessionId from returned records to prevent clients from seeing others' session identifiers
    return activeRecords.map(({ sessionId: _, ...rest }) => rest)
  },
})

/**
 * Remove presence for a session (called on unmount/tab close).
 * Only the session owner can remove their presence.
 */
export const removePresence = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .unique()

    if (!existing) {
      return
    }

    // Verify session ownership: if the presence record has a userId,
    // the caller must be that authenticated user
    if (existing.userId) {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Authentication required to remove this presence')
      }

      const user = await ctx.db
        .query('users')
        .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
        .unique()

      if (!user || user._id !== existing.userId) {
        throw new Error('Cannot remove presence for another user')
      }
    }

    await ctx.db.delete(existing._id)
  },
})

/**
 * Mark presence as inactive (called when tab becomes hidden).
 * Only the session owner can set their presence as inactive.
 */
export const setPresenceInactive = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .unique()

    if (!existing) {
      return
    }

    // Verify session ownership: if the presence record has a userId,
    // the caller must be that authenticated user
    if (existing.userId) {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) {
        throw new Error('Authentication required to modify this presence')
      }

      const user = await ctx.db
        .query('users')
        .withIndex('workosId', (q) => q.eq('workosId', identity.subject))
        .unique()

      if (!user || user._id !== existing.userId) {
        throw new Error('Cannot modify presence for another user')
      }
    }

    await ctx.db.patch(existing._id, {
      isActive: false,
      lastSeenAt: Date.now(),
    })
  },
})

// Batch size for paginated cleanup
const CLEANUP_BATCH_SIZE = 100

/**
 * Cleanup stale presence records (>60 seconds old).
 * Called by cron job. Uses pagination to handle large numbers of records.
 */
export const cleanupStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const threshold = Date.now() - CLEANUP_THRESHOLD_MS
    let totalDeleted = 0

    // Use index to efficiently query stale records in batches
    // The by_lastSeenAt index allows us to query records older than threshold
    let hasMore = true

    while (hasMore) {
      const staleRecords = await ctx.db
        .query('presence')
        .withIndex('by_lastSeenAt', (q) => q.lt('lastSeenAt', threshold))
        .take(CLEANUP_BATCH_SIZE)

      if (staleRecords.length === 0) {
        hasMore = false
        break
      }

      // Delete batch in parallel (all within same transaction)
      await Promise.all(staleRecords.map((record) => ctx.db.delete(record._id)))
      totalDeleted += staleRecords.length

      // If we got fewer than batch size, we're done
      if (staleRecords.length < CLEANUP_BATCH_SIZE) {
        hasMore = false
      }
    }

    return { deleted: totalDeleted }
  },
})
