import { describe, expect, it } from 'vitest'
import { pluralize } from './pluralize'

describe('pluralize', () => {
  it('returns singular form for a count of one', () => {
    expect(pluralize(1, 'card')).toBe('card')
  })

  it('returns default plural form for non-singular counts', () => {
    expect(pluralize(0, 'card')).toBe('cards')
    expect(pluralize(2, 'card')).toBe('cards')
  })

  it('supports custom plural forms', () => {
    expect(pluralize(2, 'is', 'are')).toBe('are')
  })
})
