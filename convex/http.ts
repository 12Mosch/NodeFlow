import { httpRouter } from 'convex/server'
import * as Sentry from '@sentry/tanstackstart-react'
import { httpAction } from './_generated/server'
import { requireUser } from './auth'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const http = httpRouter()

/**
 * HTTP endpoint to serve images from Convex storage.
 * This allows us to use a stable URL for images in the editor.
 *
 * Requires authentication and verifies that the requesting user has access
 * to the file by checking file ownership in the database.
 */
http.route({
  path: '/getImage',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    return await Sentry.startSpan(
      { name: 'http.getImage', op: 'http.server' },
      async () => {
        const url = new URL(request.url)
        const storageId = url.searchParams.get('storageId')

        if (!storageId) {
          return new Response('Missing storageId parameter', { status: 400 })
        }

        // Validate storage ID format
        const isValidFormat = await ctx.runQuery(
          internal.files.validateStorageId,
          { storageId },
        )

        if (!isValidFormat) {
          return new Response('Invalid storageId format', { status: 400 })
        }

        // Type assertion is now safe after validation
        const validatedStorageId = storageId as Id<'_storage'>

        try {
          // Authenticate the user
          const userId = await requireUser(ctx)

          // Verify the file exists and belongs to the authenticated user
          const file = await ctx.runQuery(internal.files.checkFileAccess, {
            storageId: validatedStorageId,
            userId,
          })

          if (!file) {
            return new Response('File not found or access denied', {
              status: 404,
            })
          }

          // Get the blob from storage
          const blob = await ctx.storage.get(validatedStorageId)

          if (!blob) {
            return new Response('File not found', { status: 404 })
          }

          // Determine Content-Type, handling null, undefined, and empty strings
          const contentType =
            blob.type && blob.type.trim() !== ''
              ? blob.type
              : 'application/octet-stream'

          // Return the image with appropriate headers
          return new Response(blob, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          })
        } catch (error) {
          // Handle authentication errors
          if (error instanceof Error && error.message === 'Not authenticated') {
            return new Response('Unauthorized', { status: 401 })
          }
          if (error instanceof Error && error.message === 'User not found') {
            return new Response('Unauthorized', { status: 401 })
          }

          console.error('Error fetching image:', error)
          Sentry.captureException(error, {
            tags: { operation: 'http.getImage', storageId },
          })
          return new Response('Error fetching image', { status: 500 })
        }
      },
    )
  }),
})

export default http
