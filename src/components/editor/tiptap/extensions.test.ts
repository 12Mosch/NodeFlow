import { describe, expect, it, vi } from 'vitest'
import { IMAGE_MIME_TYPES, createEditorExtensions } from './extensions'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import {
  parseDocumentIdAttribute,
  renderDocumentIdAttribute,
} from '@/extensions/extended-link'

describe('tiptap extension wiring', () => {
  it('parses and renders document link attributes', () => {
    const element = document.createElement('a')
    element.setAttribute('data-document-id', 'doc_123')

    expect(parseDocumentIdAttribute(element)).toBe('doc_123')
    expect(renderDocumentIdAttribute({ documentId: null })).toEqual({})
    expect(renderDocumentIdAttribute({ documentId: 'doc_123' })).toEqual({
      'data-document-id': 'doc_123',
    })
  })

  it('keeps image mime type allow-list for uploads and paste', () => {
    expect(IMAGE_MIME_TYPES).toContain('image/png')
    expect(IMAGE_MIME_TYPES).toContain('image/heif')
    expect(IMAGE_MIME_TYPES.length).toBeGreaterThan(5)
  })

  it('builds the editor extension list including core link and block sync wiring', () => {
    const onBlockUpdate = vi.fn(
      (_docId: Id<'documents'>, _block: BlockData) => undefined,
    )
    const onBlocksDelete = vi.fn(
      (_docId: Id<'documents'>, _nodeIds: Array<string>) => undefined,
    )
    const onInitialSync = vi.fn(
      (_docId: Id<'documents'>, _blocks: Array<BlockData>) => undefined,
    )

    const extensions = createEditorExtensions({
      documentId: 'doc_test' as Id<'documents'>,
      onBlockUpdate,
      onBlocksDelete,
      onInitialSync,
      onCursorChange: undefined,
      extension: null,
      onInlineMathClick: vi.fn(),
      onBlockMathClick: vi.fn(),
    })

    expect(extensions.length).toBeGreaterThan(10)
    expect(extensions.some((extension) => extension.name === 'link')).toBe(true)
    expect(
      extensions.some((extension) =>
        extension.name.toLowerCase().includes('block'),
      ),
    ).toBe(true)
  })
})
