import { describe, expect, it } from 'vitest'
import { applyFilter, compareValues, parseDate } from './database-view.utils'

describe('database-view.utils', () => {
  it('parses valid dates and rejects null/invalid dates', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate('2026-02-12')).toBeInstanceOf(Date)
  })

  it('handles isEmpty/isNotEmpty filter operators', () => {
    expect(applyFilter('', 'isEmpty', null, 'text')).toBe(true)
    expect(applyFilter(null, 'isEmpty', null, 'text')).toBe(true)
    expect(applyFilter('value', 'isEmpty', null, 'text')).toBe(false)
    expect(applyFilter('value', 'isNotEmpty', null, 'text')).toBe(true)
    expect(applyFilter(undefined, 'isNotEmpty', null, 'text')).toBe(false)
  })

  it('evaluates number, date, and string comparison operators', () => {
    expect(applyFilter(10, 'gt', 5, 'number')).toBe(true)
    expect(applyFilter(10, 'lte', 10, 'number')).toBe(true)
    expect(applyFilter('2026-02-14', 'gte', '2026-02-13', 'date')).toBe(true)
    expect(applyFilter('2026-02-12', 'lt', '2026-02-13', 'date')).toBe(true)
    expect(applyFilter('NodeFlow', 'contains', 'node', 'text')).toBe(true)
    expect(applyFilter('NodeFlow', 'notContains', 'quiz', 'text')).toBe(true)
  })

  it('returns false for non-empty operators when value is nullish', () => {
    expect(applyFilter(null, 'equals', 'value', 'text')).toBe(false)
    expect(applyFilter(undefined, 'contains', 'value', 'text')).toBe(false)
  })

  it('supports equals and notEquals operators', () => {
    expect(applyFilter('Alpha', 'equals', 'Alpha', 'text')).toBe(true)
    expect(applyFilter('Alpha', 'equals', 'Beta', 'text')).toBe(false)
    expect(applyFilter('Alpha', 'notEquals', 'Beta', 'text')).toBe(true)
    expect(applyFilter('Alpha', 'notEquals', 'Alpha', 'text')).toBe(false)
  })

  it('falls through unknown operators as a no-op match', () => {
    expect(applyFilter('value', 'unknown', 'anything', 'text')).toBe(true)
  })

  it('compares number and default string column types', () => {
    expect(compareValues(10, 2, 'number')).toBeGreaterThan(0)
    expect(compareValues(2, 10, 'number')).toBeLessThan(0)
    expect(compareValues('beta', 'alpha', 'text')).toBeGreaterThan(0)
    expect(compareValues('alpha', 'beta', 'text')).toBeLessThan(0)
  })

  it('keeps invalid date ordering stable in compareValues', () => {
    expect(compareValues('invalid-date', '2026-02-12', 'date')).toBe(1)
    expect(compareValues('2026-02-12', 'invalid-date', 'date')).toBe(-1)
    expect(compareValues('invalid-a', 'invalid-b', 'date')).toBe(0)
  })
})
