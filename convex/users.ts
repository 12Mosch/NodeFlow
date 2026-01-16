import { v } from 'convex/values'
import { action, mutation, query } from './_generated/server'
import { requireUser } from './auth'
import { api } from './_generated/api'

// Helper to split an array into chunks of a given size
function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

// Helper to map WorkOS user response to our database fields
// WorkOS API uses snake_case in responses
function mapWorkOSUser(workosUser: {
  email: string
  first_name?: string | null
  last_name?: string | null
  profile_picture_url?: string | null
}) {
  const nameParts = [workosUser.first_name, workosUser.last_name].filter(
    Boolean,
  )
  return {
    email: workosUser.email,
    name: nameParts.length > 0 ? nameParts.join(' ') : undefined,
    avatarUrl: workosUser.profile_picture_url ?? undefined,
  }
}

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

    // Sync data from WorkOS identity
    const email = identity.email ?? ''
    const name = identity.name ?? undefined
    const avatarUrl = identity.pictureUrl ?? undefined

    if (existing) {
      // Update existing user with latest WorkOS data
      const needsUpdate =
        existing.email !== email ||
        existing.name !== name ||
        existing.avatarUrl !== avatarUrl

      if (needsUpdate) {
        await ctx.db.patch(existing._id, {
          email,
          name,
          avatarUrl,
          updatedAt: Date.now(),
        })
      }
      return existing._id
    }

    return await ctx.db.insert('users', {
      workosId,
      email,
      name,
      avatarUrl,
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

export const updateUser = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)

    await ctx.db.patch(userId, {
      name: args.name,
      updatedAt: Date.now(),
    })
  },
})

export const updateUserFromWorkOS = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)

    await ctx.db.patch(userId, {
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      updatedAt: Date.now(),
    })
  },
})

export const updateEmailInWorkOS = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const workosUserId = identity.subject
    const apiKey = process.env.WORKOS_API_KEY

    if (!apiKey) {
      throw new Error('WORKOS_API_KEY environment variable is not set')
    }

    // Update user email in WorkOS
    const response = await fetch(
      `https://api.workos.com/user_management/users/${workosUserId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: args.email,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        error.message || `Failed to update email in WorkOS: ${response.status}`,
      )
    }

    const workosUser = await response.json()
    const userData = mapWorkOSUser(workosUser)

    // Update email in Convex database
    await ctx.runMutation(api.users.updateUserFromWorkOS, userData)

    return { email: userData.email }
  },
})

export const updateNameInWorkOS = action({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const workosUserId = identity.subject
    const apiKey = process.env.WORKOS_API_KEY

    if (!apiKey) {
      throw new Error('WORKOS_API_KEY environment variable is not set')
    }

    // Split name into firstName and lastName for WorkOS
    // WorkOS uses separate firstName/lastName fields
    let firstName: string | null = null
    let lastName: string | null = null

    if (args.name) {
      const nameParts = args.name.trim().split(/\s+/)
      firstName = nameParts[0] || null
      lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
    }

    // Update user name in WorkOS
    const response = await fetch(
      `https://api.workos.com/user_management/users/${workosUserId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        error.message || `Failed to update name in WorkOS: ${response.status}`,
      )
    }

    const workosUser = await response.json()
    const userData = mapWorkOSUser(workosUser)

    // Update name in Convex database
    await ctx.runMutation(api.users.updateUserFromWorkOS, userData)

    return { name: userData.name }
  },
})

export const syncFromWorkOS = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const workosUserId = identity.subject
    const apiKey = process.env.WORKOS_API_KEY

    if (!apiKey) {
      throw new Error('WORKOS_API_KEY environment variable is not set')
    }

    // Fetch user details from WorkOS User Management API
    const response = await fetch(
      `https://api.workos.com/user_management/users/${workosUserId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch user from WorkOS: ${response.status}`)
    }

    const workosUser = await response.json()
    const userData = mapWorkOSUser(workosUser)

    // Update user in database
    await ctx.runMutation(api.users.updateUserFromWorkOS, userData)

    return { email: userData.email, name: userData.name }
  },
})

// Batch size for deletions to avoid exceeding Convex mutation limits
const DELETE_BATCH_SIZE = 500

// Internal mutation to delete all user data from Convex
export const deleteAccountData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)

    // 1. Get all cardStates for this user
    const cardStates = await ctx.db
      .query('cardStates')
      .withIndex('by_user_due', (q) => q.eq('userId', userId))
      .collect()

    // 2. Fetch all reviewLogs for all cardStates in parallel
    const reviewLogsPerCardState = await Promise.all(
      cardStates.map((cardState) =>
        ctx.db
          .query('reviewLogs')
          .withIndex('by_cardState', (q) => q.eq('cardStateId', cardState._id))
          .collect(),
      ),
    )
    const allReviewLogs = reviewLogsPerCardState.flat()

    // 3. Collect IDs to delete
    const reviewLogIds = allReviewLogs.map((log) => log._id)
    const cardStateIds = cardStates.map((cs) => cs._id)

    // 4. Delete reviewLogs in batches
    for (const batch of chunk(reviewLogIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.db.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete reviewLog ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 5. Delete cardStates in batches
    for (const batch of chunk(cardStateIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.db.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete cardState ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 6. Get all documents for this user
    const documents = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    // 7. Fetch all blocks and files for all documents in parallel
    const [blocksPerDocument, filesPerDocument] = await Promise.all([
      Promise.all(
        documents.map((document) =>
          ctx.db
            .query('blocks')
            .withIndex('by_document', (q) => q.eq('documentId', document._id))
            .collect(),
        ),
      ),
      Promise.all(
        documents.map((document) =>
          ctx.db
            .query('files')
            .withIndex('by_document', (q) => q.eq('documentId', document._id))
            .collect(),
        ),
      ),
    ])
    const allBlocks = blocksPerDocument.flat()
    const allFiles = filesPerDocument.flat()

    // 8. Collect IDs to delete
    const blockIds = allBlocks.map((block) => block._id)
    const fileIds = allFiles.map((file) => file._id)
    const documentIds = documents.map((doc) => doc._id)
    const storageIds = allFiles.map((file) => file.storageId)

    // 9. Delete blocks in batches
    for (const batch of chunk(blockIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.db.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete block ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 10. Delete files in batches
    for (const batch of chunk(fileIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.db.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete file ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 11. Delete documents in batches
    for (const batch of chunk(documentIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.db.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete document ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 12. Delete storage files in batches after DB operations succeed
    for (const batch of chunk(storageIds, DELETE_BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((id) => ctx.storage.delete(id)),
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status !== 'fulfilled') {
          throw new Error(
            `Failed to delete storage file ${batch[i]}: ${result.reason?.message ?? result.reason}`,
          )
        }
      }
    }

    // 13. Delete the user
    await ctx.db.delete(userId)
  },
})

// Action to delete account from both WorkOS and Convex
export const deleteAccount = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const workosUserId = identity.subject
    const apiKey = process.env.WORKOS_API_KEY

    if (!apiKey) {
      throw new Error('WORKOS_API_KEY environment variable is not set')
    }

    // 1. Delete all user data from Convex first
    await ctx.runMutation(api.users.deleteAccountData, {})

    // 2. Delete user from WorkOS
    const response = await fetch(
      `https://api.workos.com/user_management/users/${workosUserId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    )

    if (!response.ok && response.status !== 404) {
      // 404 means user already deleted, which is fine
      throw new Error(`Failed to delete user from WorkOS: ${response.status}`)
    }

    return { success: true }
  },
})
