import Link from '@tiptap/extension-link'

export function parseDocumentIdAttribute(element: Element) {
  return element.getAttribute('data-document-id')
}

export function renderDocumentIdAttribute(attributes: {
  documentId?: string | null
}) {
  if (!attributes.documentId) {
    return {}
  }

  return { 'data-document-id': attributes.documentId }
}

/**
 * Extended Link extension that adds documentId attribute for internal document links.
 * - External links: { href: "https://example.com", documentId: null }
 * - Document links: { href: "/doc/{docId}", documentId: "{docId}" }
 */
export const ExtendedLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      documentId: {
        default: null,
        parseHTML: parseDocumentIdAttribute,
        renderHTML: renderDocumentIdAttribute,
      },
    }
  },
})
