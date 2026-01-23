import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { ImageAlignment } from '@/extensions/image'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

const CORNERS: ReadonlyArray<Corner> = ['nw', 'ne', 'sw', 'se']

export function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, title, width, height, align } = node.attrs
  const alignment = align as ImageAlignment
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(
    null,
  )
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  // Derive aspect ratio from props if available, otherwise use natural aspect ratio
  const aspectRatio = width && height ? width / height : naturalAspectRatio

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current
      if (naturalWidth && naturalHeight) {
        setNaturalAspectRatio(naturalWidth / naturalHeight)
        // Set initial dimensions if not already set
        if (!width && !height) {
          updateAttributes({ width: naturalWidth, height: naturalHeight })
        }
      }
    }
  }, [width, height, updateAttributes])

  const handleResizeStart = useCallback(
    (corner: Corner, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!containerRef.current || !aspectRatio) return

      const parentElement = containerRef.current.parentElement
      if (!parentElement) return

      // Clean up any previous resize handlers
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }

      const startX = e.clientX
      const startY = e.clientY
      const startWidth = width || containerRef.current.offsetWidth
      const parentWidth = parentElement.offsetWidth

      setIsResizing(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        let deltaX = moveEvent.clientX - startX
        let deltaY = moveEvent.clientY - startY

        // Determine resize direction based on corner
        if (corner === 'nw' || corner === 'sw') {
          deltaX = -deltaX
        }
        if (corner === 'nw' || corner === 'ne') {
          deltaY = -deltaY
        }

        // Determine dominant axis based on raw mouse movement (no scaling)
        // This ensures consistent resize sensitivity regardless of aspect ratio
        let newWidth: number
        let newHeight: number

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal drag - width changes directly with mouse movement
          newWidth = Math.round(startWidth + deltaX)
          newHeight = Math.round(newWidth / aspectRatio)
        } else {
          // Vertical drag - height changes directly, width follows
          const startHeight = startWidth / aspectRatio
          newHeight = Math.round(startHeight + deltaY)
          newWidth = Math.round(newHeight * aspectRatio)
        }

        // Enforce constraints
        const minWidth = 50
        const maxWidth = parentWidth

        if (newWidth < minWidth) {
          newWidth = minWidth
          newHeight = Math.round(minWidth / aspectRatio)
        }

        if (newWidth > maxWidth) {
          newWidth = maxWidth
          newHeight = Math.round(maxWidth / aspectRatio)
        }

        updateAttributes({ width: newWidth, height: newHeight })
      }

      const cleanup = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        cleanupRef.current = null
      }

      const handleMouseUp = () => {
        cleanup()
      }

      // Store cleanup function for unmount
      cleanupRef.current = cleanup

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [aspectRatio, width, updateAttributes],
  )

  return (
    <NodeViewWrapper
      className={`image-view-wrapper image-align-${alignment}`}
      draggable
      data-drag-handle=""
    >
      <div
        ref={containerRef}
        className={`image-view-container ${selected ? 'is-selected' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{ width: width ? `${width}px` : undefined }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || undefined}
          width={width || undefined}
          height={height || undefined}
          onLoad={handleImageLoad}
          draggable={false}
        />
        {selected &&
          CORNERS.map((corner) => (
            <div
              key={corner}
              className={`resize-handle resize-handle-${corner}`}
              onMouseDown={(e) => handleResizeStart(corner, e)}
              contentEditable={false}
            />
          ))}
      </div>
    </NodeViewWrapper>
  )
}
