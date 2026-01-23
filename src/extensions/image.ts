import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageView } from '@/components/editor/image-view'

export type ImageAlignment = 'left' | 'center' | 'right'

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    extendedImage: {
      setImageAlignment: (alignment: ImageAlignment) => ReturnType
    }
  }
}

/**
 * Extended Image extension that supports width, height, and align attributes
 * to prevent layout shifts when images load and allow horizontal positioning.
 */
export const ExtendedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          return {
            width: String(attributes.width),
          }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {}
          }
          return {
            height: String(attributes.height),
          }
        },
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.align,
        }),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const attributes = mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
    )

    // Only set loading="lazy" if dimensions are present to prevent layout shifts
    if (attributes.width && attributes.height) {
      attributes.loading = 'lazy'
    }

    return ['img', attributes]
  },

  addCommands() {
    return {
      setImageAlignment:
        (alignment: ImageAlignment) =>
        ({ commands }) => {
          return commands.updateAttributes('image', { align: alignment })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
