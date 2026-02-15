import { describe, expect, it } from 'vitest'
import {
  toDifficultyBucketLabel,
  toggleDifficultyBucket,
  toggleRetentionSeries,
} from './useAnalyticsInteractions'

describe('analytics interaction helpers', () => {
  it('toggles retention series selection', () => {
    expect(toggleRetentionSeries(null, 'seven')).toBe('seven')
    expect(toggleRetentionSeries('seven', 'seven')).toBeNull()
    expect(toggleRetentionSeries('seven', 'thirty')).toBe('thirty')
  })

  it('toggles difficulty bucket selection', () => {
    expect(toggleDifficultyBucket(null, '3-4')).toBe('3-4')
    expect(toggleDifficultyBucket('3-4', '3-4')).toBeNull()
    expect(toggleDifficultyBucket('3-4', '5-6')).toBe('5-6')
  })

  it('normalizes known and unknown difficulty labels', () => {
    expect(toDifficultyBucketLabel('3-4')).toBe('3-4')
    expect(toDifficultyBucketLabel('unknown')).toBeNull()
  })
})
