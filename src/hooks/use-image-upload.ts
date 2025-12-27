import { useMutation } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface UseImageUploadOptions {
  documentId: Id<'documents'>
  onUploadStart?: () => void
  onUploadComplete?: (url: string) => void
  onUploadError?: (error: Error) => void
}

interface UploadResult {
  url: string
  storageId: Id<'_storage'>
}

/**
 * Constructs the HTTP endpoint URL for serving images from Convex storage.
 *
 * Convex HTTP endpoints are served from `.convex.site` domains, while the
 * backend API is on `.convex.cloud`. This function safely transforms the
 * Convex URL to the HTTP endpoint URL.
 *
 * @param storageId - The Convex storage ID for the image
 * @returns The full URL to the /getImage endpoint
 * @throws Error if VITE_CONVEX_URL is missing or malformed
 */
function constructImageUrl(storageId: Id<'_storage'>): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL

  if (!convexUrl || typeof convexUrl !== 'string') {
    throw new Error(
      'VITE_CONVEX_URL environment variable is missing or invalid',
    )
  }

  try {
    // Parse the Convex URL to extract components
    const url = new URL(convexUrl)
    const hostname = url.hostname

    // Transform the hostname: .convex.cloud -> .convex.site
    // This handles the standard Convex deployment pattern
    let httpHostname: string
    if (hostname.endsWith('.convex.cloud')) {
      httpHostname = hostname.replace('.convex.cloud', '.convex.site')
    } else if (hostname.endsWith('.convex.site')) {
      // Already a site URL, use as-is
      httpHostname = hostname
    } else if (
      hostname === 'localhost' ||
      hostname.startsWith('127.0.0.1') ||
      hostname.startsWith('192.168.')
    ) {
      // Local development - use the same hostname
      // Note: In local dev, Convex HTTP endpoints may be on a different port
      // but typically share the same hostname
      httpHostname = hostname
    } else {
      // Custom domain or unexpected format
      // Log a warning but attempt to construct URL anyway
      console.warn(
        `Unexpected Convex URL format: ${hostname}. ` +
          `Expected .convex.cloud or .convex.site domain. ` +
          `Image URL may not work correctly.`,
      )
      Sentry.captureMessage('Unexpected Convex URL format', {
        level: 'warning',
        extra: { hostname, convexUrl },
      })
      // For custom domains, assume they might work as-is or use a fallback
      httpHostname = hostname
    }

    // Construct the HTTP endpoint URL
    const httpUrl = new URL(url)
    httpUrl.hostname = httpHostname
    httpUrl.pathname = '/getImage'
    httpUrl.search = `?storageId=${storageId}`

    return httpUrl.toString()
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Invalid VITE_CONVEX_URL format: ${convexUrl}. ` +
          `Expected a valid URL (e.g., https://xxx.convex.cloud)`,
      )
    }
    throw error
  }
}

export function useImageUpload({
  documentId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UseImageUploadOptions) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const storeFile = useMutation(api.files.storeFile)

  async function uploadImage(file: File): Promise<UploadResult | null> {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      const error = new Error('Only image files are allowed')
      toast.error('Only image files are allowed')
      onUploadError?.(error)
      return null
    }

    // Limit file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      const error = new Error('File size must be less than 10MB')
      toast.error('File size must be less than 10MB')
      onUploadError?.(error)
      return null
    }

    try {
      onUploadStart?.()

      return await Sentry.startSpan(
        { name: 'ImageUpload.upload', op: 'file.upload' },
        async () => {
          // Step 1: Get upload URL from Convex
          const uploadUrl = await generateUploadUrl()

          // Step 2: Upload file to Convex storage
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          })

          if (!response.ok) {
            throw new Error('Failed to upload file')
          }

          const { storageId } = (await response.json()) as {
            storageId: Id<'_storage'>
          }

          // Step 3: Store file reference in database
          await storeFile({
            storageId,
            documentId,
            fileName: file.name,
            mimeType: file.type,
          })

          // Step 4: Construct the URL for the image
          // Use robust URL construction that handles various deployment scenarios
          const url = constructImageUrl(storageId)

          onUploadComplete?.(url)

          return { url, storageId }
        },
      )
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed')
      onUploadError?.(err)
      Sentry.captureException(error)
      return null
    }
  }

  return { uploadImage }
}
