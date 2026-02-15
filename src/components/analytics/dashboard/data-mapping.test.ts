import { describe, expect, it } from 'vitest'
import { buildDerivedAnalytics } from './useDerivedAnalytics'
import type { AnalyticsDashboardDataValue } from './types'
import {
  analyticsDashboardFixture,
  analyticsEmptyDashboardFixture,
} from '@/test/fixtures/analytics'

describe('buildDerivedAnalytics', () => {
  it('maps populated analytics data into dashboard view data', () => {
    const result = buildDerivedAnalytics(
      analyticsDashboardFixture as AnalyticsDashboardDataValue,
      0,
    )

    expect(result).not.toBeNull()
    expect(result.hasReviews).toBe(true)
    expect(result.hasHourlyPerformance).toBe(true)
    expect(result.hasForecast).toBe(true)
    expect(result.intervalHighlight).toBe('8-14d (88.0%)')
    expect(result.peakDayValue).toBe('4')
    expect(result.recommendationIndicator).toBeNull()
  })

  it('maps empty analytics data to empty-state metadata', () => {
    const result = buildDerivedAnalytics(
      analyticsEmptyDashboardFixture as AnalyticsDashboardDataValue,
      0,
    )

    expect(result).not.toBeNull()
    expect(result.hasReviews).toBe(false)
    expect(result.hasHourlyPerformance).toBe(false)
    expect(result.hasForecast).toBe(false)
    expect(result.intervalHighlight).toBe('—')
    expect(result.peakDayValue).toBe('0')
    expect(result.recommendationIndicator).toBe('low-data')
  })
})
