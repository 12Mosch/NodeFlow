import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'

/**
 * Extended Image extension that supports width and height attributes
 * to prevent layout shifts when images load.
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
})
