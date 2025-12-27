import { useCallback } from 'react'
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

export function useImageUpload({
  documentId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UseImageUploadOptions) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const storeFile = useMutation(api.files.storeFile)

  const uploadImage = useCallback(
    async (file: File): Promise<UploadResult | null> => {
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
            // Convex storage URLs follow this pattern
            const convexUrl = import.meta.env.VITE_CONVEX_URL as string
            const siteUrl = convexUrl.replace('.convex.cloud', '.convex.site')
            const url = `${siteUrl}/getImage?storageId=${storageId}`

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
    },
    [
      documentId,
      generateUploadUrl,
      storeFile,
      onUploadStart,
      onUploadComplete,
      onUploadError,
    ],
  )

  return { uploadImage }
}
