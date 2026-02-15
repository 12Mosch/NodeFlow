import { describe, expect, it } from 'vitest'
import {
  SNIPPET_MAX_LENGTH,
  applyFuzzyFilter,
  extractSnippet,
  highlightMatch,
  isSearchResult,
} from './search-dialog.utils'
import type { SearchResult } from './search-dialog.utils'
import type { Id } from '../../convex/_generated/dataModel'

const docId1 = 'doc_1' as Id<'documents'>
const docId2 = 'doc_2' as Id<'documents'>
const blockId1 = 'block_1' as Id<'blocks'>

const searchResultsFixture: SearchResult = {
  documents: [
    {
      _id: docId1,
      title: 'Cell Biology Notes',
    },
    {
      _id: docId2,
      title: 'Chemistry Review',
    },
  ],
  blocks: [
    {
      _id: blockId1,
      documentId: docId1,
      documentTitle: 'Cell Biology Notes',
      textContent: 'Cellular respiration transforms glucose into ATP.',
      type: 'paragraph',
    },
  ],
}

describe('search-dialog.utils', () => {
  it('rejects malformed search payloads at runtime', () => {
    expect(isSearchResult(null)).toBe(false)
    expect(isSearchResult({ documents: [], blocks: [{}] })).toBe(false)
    expect(
      isSearchResult({
        documents: [{ _id: 'doc_1', title: 'Valid' }],
        blocks: 'invalid',
      }),
    ).toBe(false)
  })

  it('extracts snippets using exact or fuzzy match fallback', () => {
    const text =
      'Mitochondria are the powerhouse of the cell and help drive respiration.'

    const exactSnippet = extractSnippet(text, 'powerhouse')
    expect(exactSnippet).toContain('powerhouse')

    const fuzzySnippet = extractSnippet(text, 'powrhouse')
    expect(fuzzySnippet).toContain('powerhouse')
  })

  it('enforces truncation and ellipsis boundaries for long snippets', () => {
    const longText = `Start ${'x'.repeat(80)} middle-match ${'y'.repeat(80)} end`

    const aroundMiddle = extractSnippet(longText, 'middle-match')
    expect(aroundMiddle.startsWith('...')).toBe(true)
    expect(aroundMiddle.endsWith('...')).toBe(true)

    const fallbackFromStart = extractSnippet('a'.repeat(200), 'no-match-here')
    expect(fallbackFromStart.length).toBe(SNIPPET_MAX_LENGTH + '...'.length)
    expect(fallbackFromStart.endsWith('...')).toBe(true)
  })

  it('falls back to original results when Fuse finds no fuzzy matches', () => {
    const filtered = applyFuzzyFilter(searchResultsFixture, 'zzzz')
    expect(filtered?.documents).toEqual(searchResultsFixture.documents)
    expect(filtered?.blocks).toEqual(searchResultsFixture.blocks)
  })

  it('returns plain text from highlight helper when query is empty', () => {
    const highlighted = highlightMatch('Cell Biology', ' ')
    expect(highlighted).toBe('Cell Biology')
  })
})
