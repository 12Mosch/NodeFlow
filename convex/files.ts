import { v } from 'convex/values'
import * as Sentry from '@sentry/tanstackstart-react'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'

/**
 * Generate a URL for uploading a file to Convex storage.
 * This URL is short-lived and can be used by the client to upload a file.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'files.generateUploadUrl', op: 'convex.mutation' },
      async () => {
        // Ensure user is authenticated
        await requireUser(ctx)

        // Generate and return the upload URL
        return await ctx.storage.generateUploadUrl()
      },
    )
  },
})

/**
 * Store a file reference in the database after upload.
 * This associates the uploaded file with a document.
 */
export const storeFile = mutation({
  args: {
    storageId: v.id('_storage'),
    documentId: v.id('documents'),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'files.storeFile', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        // Verify document exists and belongs to user
        const document = await ctx.db.get(args.documentId)
        if (!document || document.userId !== userId) {
          throw new Error('Document not found or access denied')
        }

        // Store file reference
        const fileId = await ctx.db.insert('files', {
          storageId: args.storageId,
          documentId: args.documentId,
          userId,
          fileName: args.fileName,
          mimeType: args.mimeType,
          createdAt: now,
        })

        return fileId
      },
    )
  },
})

/**
 * Get the URL for a stored file by its storage ID.
 */
export const getFileUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'files.getFileUrl', op: 'convex.query' },
      async () => {
        // Generate the URL for the file
        const url = await ctx.storage.getUrl(args.storageId)
        return url
      },
    )
  },
})

/**
 * Get all files associated with a document.
 */
export const getFilesByDocument = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'files.getFilesByDocument', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)

        // Verify document access
        const document = await ctx.db.get(args.documentId)
        if (!document || document.userId !== userId) {
          return []
        }

        const files = await ctx.db
          .query('files')
          .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
          .collect()

        // Get URLs for all files
        const filesWithUrls = await Promise.all(
          files.map(async (file) => ({
            ...file,
            url: await ctx.storage.getUrl(file.storageId),
          })),
        )

        return filesWithUrls
      },
    )
  },
})

/**
 * Delete a file from storage and database.
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id('files'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'files.deleteFile', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const file = await ctx.db.get(args.fileId)
        if (!file || file.userId !== userId) {
          throw new Error('File not found or access denied')
        }

        // Delete from storage
        await ctx.storage.delete(file.storageId)

        // Delete from database
        await ctx.db.delete(args.fileId)
      },
    )
  },
})
