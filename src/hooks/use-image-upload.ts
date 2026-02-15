import { useCallback, useEffect, useRef } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface UseImageUploadOptions {
  documentId: Id<'documents'>
  onUploadStart?: () => void
  onUploadComplete?: (url: string, dimensions: ImageDimensions) => void
  onUploadError?: (error: Error) => void
}
interface ImageDimensions {
  width: number
  height: number
}
interface UploadResult {
  url: string
  storageId: Id<'_storage'>
  dimensions: ImageDimensions
}
/**
 * Gets the dimensions of an image file.
 *
 * @param file - The image file
 * @returns Promise resolving to image dimensions
 */
function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image to get dimensions'))
    }
    img.src = objectUrl
  })
}
export function useImageUpload({
  documentId,
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UseImageUploadOptions) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const storeFile = useMutation(api.files.storeFile)
  const onUploadStartRef = useRef(onUploadStart)
  const onUploadCompleteRef = useRef(onUploadComplete)
  const onUploadErrorRef = useRef(onUploadError)

  useEffect(() => {
    onUploadStartRef.current = onUploadStart
  }, [onUploadStart])

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete
  }, [onUploadComplete])

  useEffect(() => {
    onUploadErrorRef.current = onUploadError
  }, [onUploadError])

  const uploadImage = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        const error = new Error('Only image files are allowed')
        toast.error('Only image files are allowed')
        onUploadErrorRef.current?.(error)
        return null
      }
      // Limit file size (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        const error = new Error('File size must be less than 10MB')
        toast.error('File size must be less than 10MB')
        onUploadErrorRef.current?.(error)
        return null
      }
      try {
        onUploadStartRef.current?.()
        // Step 1: Get image dimensions before upload
        // This allows us to set width/height attributes to prevent layout shifts
        const dimensions = await getImageDimensions(file)
        // Step 2: Get upload URL from Convex
        const uploadUrl = await generateUploadUrl()
        // Step 3: Upload file to Convex storage
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
        // Step 4: Store file reference in database and get pre-signed URL
        const result = await storeFile({
          storageId,
          documentId,
          fileName: file.name,
          mimeType: file.type,
        })
        // The storeFile mutation returns the pre-signed URL from Convex storage
        // This URL works without authentication, unlike our custom HTTP endpoint
        const url = result.url
        onUploadCompleteRef.current?.(url, dimensions)
        return { url, storageId, dimensions }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed')
        onUploadErrorRef.current?.(err)
        return null
      }
    },
    [documentId, generateUploadUrl, storeFile],
  )

  return { uploadImage }
}
