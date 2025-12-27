import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import type { Id } from './_generated/dataModel'

const http = httpRouter()

/**
 * HTTP endpoint to serve images from Convex storage.
 * This allows us to use a stable URL for images in the editor.
 */
http.route({
  path: '/getImage',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const storageId = url.searchParams.get('storageId')

    if (!storageId) {
      return new Response('Missing storageId parameter', { status: 400 })
    }

    try {
      // Get the blob from storage
      const blob = await ctx.storage.get(storageId as Id<'_storage'>)

      if (!blob) {
        return new Response('File not found', { status: 404 })
      }

      // Return the image with appropriate headers
      return new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (error) {
      console.error('Error fetching image:', error)
      return new Response('Error fetching image', { status: 500 })
    }
  }),
})

export default http
