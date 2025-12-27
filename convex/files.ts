import { v } from 'convex/values'
import * as Sentry from '@sentry/tanstackstart-react'
import { internalQuery, mutation, query } from './_generated/server'
import { requireUser } from './auth'

// ============================================================================
// File Upload Configuration
// ============================================================================

/** Maximum allowed file size in bytes (10 MB) */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

/** Maximum length for sanitized file names */
const MAX_FILENAME_LENGTH = 255

/** Allowed MIME types for file uploads */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
])

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Sanitize a filename to prevent path traversal and injection attacks.
 * - Removes null bytes
 * - Replaces path separators with underscores
 * - Removes parent directory references (..)
 * - Trims whitespace and limits length
 * - Returns undefined for empty or dangerous names
 */
function sanitizeFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined

  let sanitized = fileName
    // Remove null bytes (can be used for injection attacks)
    .replace(/\0/g, '')
    // Replace path separators with underscores
    .replace(/[/\\]/g, '_')
    // Remove parent directory references
    .replace(/\.\./g, '_')
    // Remove control characters (ASCII 0-31 and 127)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Trim whitespace
    .trim()

  // Limit length (preserve extension if possible)
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const lastDot = sanitized.lastIndexOf('.')
    if (lastDot > 0 && sanitized.length - lastDot <= 10) {
      // Preserve extension if it's reasonable length
      const ext = sanitized.substring(lastDot)
      const name = sanitized.substring(0, MAX_FILENAME_LENGTH - ext.length)
      sanitized = name + ext
    } else {
      sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH)
    }
  }

  // Reject empty, dot-only, or whitespace-only names
  if (
    !sanitized ||
    sanitized === '.' ||
    sanitized === '..' ||
    !sanitized.trim()
  ) {
    return undefined
  }

  return sanitized
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
 *
 * Performs comprehensive server-side validation:
 * - Verifies the storage ID corresponds to an actual uploaded file
 * - Enforces file size limits
 * - Validates MIME type against allowlist
 * - Verifies client-provided MIME type matches actual file type
 * - Sanitizes filename to prevent path traversal/injection attacks
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

        // ================================================================
        // 1. Verify storage ID exists and get file metadata
        // ================================================================
        const metadata = await ctx.db.system.get(args.storageId)
        if (!metadata) {
          throw new Error(
            'Invalid storage ID: the referenced file does not exist or has expired',
          )
        }

        // ================================================================
        // 2. Validate file size
        // ================================================================
        if (typeof metadata.size !== 'number') {
          throw new Error('Unable to verify file size')
        }

        if (metadata.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(
            `File size (${formatBytes(metadata.size)}) exceeds maximum allowed size (${formatBytes(MAX_FILE_SIZE_BYTES)})`,
          )
        }

        // ================================================================
        // 3. Validate MIME type
        // ================================================================
        const actualMimeType = metadata.contentType

        // Verify the actual file type is in our allowlist
        if (actualMimeType && !ALLOWED_MIME_TYPES.has(actualMimeType)) {
          throw new Error(
            `File type '${actualMimeType}' is not allowed. Only image files are supported.`,
          )
        }

        // If client provided a MIME type, verify it matches the actual type
        // This prevents clients from claiming a file is a different type than it actually is
        if (
          args.mimeType &&
          actualMimeType &&
          args.mimeType !== actualMimeType
        ) {
          Sentry.captureMessage('MIME type mismatch detected', {
            level: 'warning',
            extra: {
              providedMimeType: args.mimeType,
              actualMimeType,
              storageId: args.storageId,
              userId,
            },
          })
          throw new Error(
            `Provided MIME type '${args.mimeType}' does not match actual file type '${actualMimeType}'`,
          )
        }

        // ================================================================
        // 4. Verify document exists and belongs to user
        // ================================================================
        const document = await ctx.db.get(args.documentId)
        if (!document || document.userId !== userId) {
          throw new Error('Document not found or access denied')
        }

        // ================================================================
        // 5. Sanitize filename
        // ================================================================
        const sanitizedFileName = sanitizeFileName(args.fileName)

        // Log if filename was modified during sanitization
        if (args.fileName && sanitizedFileName !== args.fileName) {
          Sentry.captureMessage('Filename was sanitized during upload', {
            level: 'info',
            extra: {
              originalFileName: args.fileName,
              sanitizedFileName,
              userId,
            },
          })
        }

        // ================================================================
        // 6. Store file reference with validated data
        // ================================================================
        const fileId = await ctx.db.insert('files', {
          storageId: args.storageId,
          documentId: args.documentId,
          userId,
          fileName: sanitizedFileName,
          // Prefer actual MIME type from storage over client-provided value
          mimeType: actualMimeType || args.mimeType,
          createdAt: now,
        })

        return fileId
      },
    )
  },
})

/**
 * Get the URL for a stored file by its storage ID.
 *
 * Requires authentication and verifies that the file belongs to the authenticated user
 * to prevent unauthorized access to other users' files.
 */
export const getFileUrl = query({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'files.getFileUrl', op: 'convex.query' },
      async () => {
        // Require authentication
        const userId = await requireUser(ctx)

        // Find the file record associated with this storage ID
        const file = await ctx.db
          .query('files')
          .withIndex('by_storage', (q) => q.eq('storageId', args.storageId))
          .first()

        // Verify file exists and belongs to the authenticated user
        if (!file || file.userId !== userId) {
          throw new Error('File not found or access denied')
        }

        // Generate and return the URL for the file
        const url = await ctx.storage.getUrl(args.storageId)
        return url
      },
    )
  },
})

/**
 * Validates a storage ID format.
 * Convex storage IDs are base64url-encoded strings.
 * This performs basic format validation to catch obviously malformed IDs.
 */
function isValidStorageIdFormat(storageId: string): boolean {
  // Basic validation: non-empty string, reasonable length, and base64url-safe characters
  // Convex storage IDs are typically base64url encoded (A-Za-z0-9_-)
  if (!storageId || storageId.length === 0 || storageId.length > 500) {
    return false
  }

  // Check for base64url-safe characters (A-Za-z0-9_-)
  // This is a basic check - Convex will do final validation when accessing storage
  const base64urlRegex = /^[A-Za-z0-9_-]+$/
  return base64urlRegex.test(storageId)
}

/**
 * Internal query to validate a storage ID format.
 * Returns true if the format appears valid, false otherwise.
 * Used by HTTP actions for ID validation before processing.
 */
export const validateStorageId = internalQuery({
  args: {
    storageId: v.string(),
  },
  handler: (_ctx, args) => {
    return isValidStorageIdFormat(args.storageId)
  },
})

/**
 * Internal query to check if a user has access to a file by storage ID.
 * Returns the file record if access is granted, null otherwise.
 * Used by HTTP actions for authorization checks.
 */
export const checkFileAccess = internalQuery({
  args: {
    storageId: v.id('_storage'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query('files')
      .withIndex('by_storage', (q) => q.eq('storageId', args.storageId))
      .first()

    if (!file || file.userId !== args.userId) {
      return null
    }

    return file
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

        // Delete from database first to ensure atomicity
        // If database deletion fails, nothing is deleted (better than dangling reference)
        await ctx.db.delete(args.fileId)

        // Delete from storage after database deletion succeeds
        // If storage deletion fails, we'll have orphaned storage but no dangling DB reference
        try {
          await ctx.storage.delete(file.storageId)
        } catch (error) {
          // Log storage deletion failure but don't fail the mutation
          // The database record is already deleted, so orphaned storage is acceptable
          console.error('Failed to delete file from storage:', error)
          // Optionally report to Sentry for monitoring
          Sentry.captureException(error, {
            tags: { operation: 'storage.delete', fileId: args.fileId },
          })
        }
      },
    )
  },
})
