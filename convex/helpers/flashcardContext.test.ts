import { describe, expect, it } from 'vitest'
import {
  buildAncestorPathByNodeId,
  getCachedAncestorPathFromAttrs,
} from './flashcardContext'
import type { BlockForFlashcardContext } from './flashcardContext'

describe('flashcardContext', () => {
  it('resolves outlineAncestorNodeIds in root-to-parent order', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'doc',
        textContent: 'Biology Notes',
        type: 'heading',
        position: 0,
      },
      {
        nodeId: 'cell',
        textContent: 'Cell',
        type: 'listItem',
        position: 1,
      },
      {
        nodeId: 'card',
        textContent: 'Mitochondria >> Energy center',
        type: 'listItem',
        position: 2,
        attrs: { outlineAncestorNodeIds: ['doc', 'cell'] },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Biology Notes', 'Cell'])
  })

  it('ignores cached outlineAncestorPath when resolving from node metadata', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'topic',
        textContent: 'Physics',
        type: 'heading',
        position: 0,
      },
      {
        nodeId: 'subtopic',
        textContent: 'Optics',
        type: 'paragraph',
        position: 1,
      },
      {
        nodeId: 'card',
        textContent: 'Question >> Answer',
        type: 'paragraph',
        position: 2,
        attrs: {
          outlineAncestorNodeIds: ['topic', 'subtopic'],
          outlineAncestorPath: ['Stale Topic'],
        },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Physics', 'Optics'])
  })

  it('normalizes cached outlineAncestorPath and rejects malformed values', () => {
    expect(
      getCachedAncestorPathFromAttrs({
        outlineAncestorPath: ['  Topic  ', 'Subtopic', '', 42],
      }),
    ).toEqual(['Topic', 'Subtopic'])
    expect(
      getCachedAncestorPathFromAttrs({ outlineAncestorPath: 'invalid' }),
    ).toBeNull()
    expect(getCachedAncestorPathFromAttrs(null)).toBeNull()
  })

  it('skips missing and blank ancestors when resolving metadata paths', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'topic',
        textContent: 'Photosynthesis',
        type: 'heading',
        position: 0,
      },
      {
        nodeId: 'blank',
        textContent: '   ',
        type: 'paragraph',
        position: 1,
      },
      {
        nodeId: 'card',
        textContent: 'Chloroplast >> Organelle for photosynthesis',
        type: 'paragraph',
        position: 2,
        attrs: {
          outlineAncestorNodeIds: ['missing', 'topic', 'blank', 'topic'],
        },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Photosynthesis'])
  })

  it('falls back to heading-stack context when metadata is absent', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'h2',
        textContent: 'Mitochondria',
        type: 'heading',
        position: 1,
        attrs: { level: 2 },
      },
      {
        nodeId: 'h1',
        textContent: 'Cell Biology',
        type: 'heading',
        position: 0,
        attrs: { level: 1 },
      },
      {
        nodeId: 'card',
        textContent: 'Cristae >> Folded inner membrane',
        type: 'paragraph',
        position: 2,
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual([
      'Cell Biology',
      'Mitochondria',
    ])
  })

  it('falls back to heading-stack context when metadata is present but unresolved', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'h1',
        textContent: 'Physics',
        type: 'heading',
        position: 0,
        attrs: { level: 1 },
      },
      {
        nodeId: 'card',
        textContent: 'Photon >> Quantum of light',
        type: 'paragraph',
        position: 1,
        attrs: { outlineAncestorNodeIds: ['missing', '   '] },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Physics'])
  })

  it('treats malformed outlineAncestorNodeIds as absent and uses heading fallback', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'h1',
        textContent: 'Chemistry',
        type: 'heading',
        position: 0,
      },
      {
        nodeId: 'card-attrs-null',
        textContent: 'Molarity >> Concentration unit',
        type: 'paragraph',
        position: 1,
        attrs: null,
      },
      {
        nodeId: 'card-attrs-primitive',
        textContent: 'Molality >> Solvent-based concentration',
        type: 'paragraph',
        position: 2,
        attrs: 42,
      },
      {
        nodeId: 'card-non-array',
        textContent: 'Normality >> Equivalent concentration',
        type: 'paragraph',
        position: 3,
        attrs: { outlineAncestorNodeIds: 'h1' },
      },
      {
        nodeId: 'card-mixed-array',
        textContent: 'ppm >> parts per million',
        type: 'paragraph',
        position: 4,
        attrs: { outlineAncestorNodeIds: [false, 4, {}, 'h1', '   '] },
      },
      {
        nodeId: 'card-empty-array',
        textContent: 'ppb >> parts per billion',
        type: 'paragraph',
        position: 5,
        attrs: { outlineAncestorNodeIds: [] },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)

    expect(contextByNodeId.get('card-attrs-null')).toEqual(['Chemistry'])
    expect(contextByNodeId.get('card-attrs-primitive')).toEqual(['Chemistry'])
    expect(contextByNodeId.get('card-non-array')).toEqual(['Chemistry'])
    expect(contextByNodeId.get('card-mixed-array')).toEqual(['Chemistry'])
    expect(contextByNodeId.get('card-empty-array')).toEqual(['Chemistry'])
  })

  it('normalizes invalid heading levels in heading-stack fallback', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'h-float',
        textContent: 'Float Heading',
        type: 'heading',
        position: 0,
        attrs: { level: 2.7 },
      },
      {
        nodeId: 'h-negative',
        textContent: 'Negative Heading',
        type: 'heading',
        position: 1,
        attrs: { level: -3 },
      },
      {
        nodeId: 'h-string',
        textContent: 'String Heading',
        type: 'heading',
        position: 2,
        attrs: { level: '2' },
      },
      {
        nodeId: 'h-nan',
        textContent: 'NaN Heading',
        type: 'heading',
        position: 3,
        attrs: { level: Number.NaN },
      },
      {
        nodeId: 'h-infinity',
        textContent: 'Infinity Heading',
        type: 'heading',
        position: 4,
        attrs: { level: Number.POSITIVE_INFINITY },
      },
      {
        nodeId: 'card',
        textContent: 'Test >> Should use level-1 reset behavior',
        type: 'paragraph',
        position: 5,
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Infinity Heading'])
  })

  it('sorts blocks by position before resolving ancestry', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'card',
        textContent: 'Cristae >> Folded membrane',
        type: 'paragraph',
        position: 20,
      },
      {
        nodeId: 'h2',
        textContent: 'Mitochondria',
        type: 'heading',
        position: 10,
        attrs: { level: 2 },
      },
      {
        nodeId: 'h1',
        textContent: 'Cell Biology',
        type: 'heading',
        position: 0,
        attrs: { level: 1 },
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual([
      'Cell Biology',
      'Mitochondria',
    ])
  })

  it('uses previous-block context for a single-level blockquote card without ancestry metadata', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'parent',
        textContent: 'Test',
        type: 'paragraph',
        position: 0,
      },
      {
        nodeId: 'card',
        textContent: 'Question :: 98234',
        type: 'blockquote',
        position: 1,
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card')).toEqual(['Test'])
  })

  it('chains context for nested blockquote cards without ancestry metadata', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'parent',
        textContent: 'TestTest',
        type: 'paragraph',
        position: 0,
      },
      {
        nodeId: 'card-1',
        textContent: 'Question :: 98239',
        type: 'blockquote',
        position: 1,
      },
      {
        nodeId: 'card-2',
        textContent: 'Two. Question :: 213',
        type: 'blockquote',
        position: 2,
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.get('card-2')).toEqual([
      'TestTest',
      'Question :: 98239',
    ])
  })

  it('does not infer blockquote context from a blank previous block', () => {
    const blocks: Array<BlockForFlashcardContext> = [
      {
        nodeId: 'blank',
        textContent: '   ',
        type: 'paragraph',
        position: 0,
      },
      {
        nodeId: 'card',
        textContent: 'Question :: 12345',
        type: 'blockquote',
        position: 1,
      },
    ]

    const contextByNodeId = buildAncestorPathByNodeId(blocks)
    expect(contextByNodeId.has('card')).toBe(false)
  })
})
