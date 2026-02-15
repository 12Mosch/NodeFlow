import { useMemo } from 'react'
import {
  HOURLY_CANDIDATE_MIN_REVIEWS,
  INTERVAL_CANDIDATE_MIN_REVIEWS,
  LOW_DATA_RECENT_14_DAY_REVIEWS_THRESHOLD,
  LOW_DATA_TOTAL_REVIEWS_THRESHOLD,
  NO_INTERVAL_HIGHLIGHT,
  findMinMaxBy,
  formatLocalHour,
  formatPercent,
  getCardTypeSampleFloor,
  getForecastAction,
  getForecastSpikeDayThreshold,
  getForecastTone,
  getIntervalAction,
  getIntervalTone,
  getRetentionAction,
  getRetentionTone,
  getTrendsAction,
  getTrendsTone,
  getWorkloadAction,
  getWorkloadTone,
  lastNonNull,
  roundToOne,
  safeAverage,
} from '../suggestion-helpers'
import type {
  AnalyticsDashboardData,
  AnalyticsDashboardDataValue,
  DerivedAnalytics,
} from './types'
import type { PeakHourLabel } from '../suggestion-helpers'

export function buildDerivedAnalytics(
  data: AnalyticsDashboardDataValue,
  offsetMinutes: number,
): DerivedAnalytics {
  const hasReviews = data.retention.daily.some((day) => day.total > 0)
  const latest7 = lastNonNull(data.retention.daily, 'rolling7')
  const latest30 = lastNonNull(data.retention.daily, 'rolling30')
  const latest90 = lastNonNull(data.retention.daily, 'rolling90')

  const peakHoursLabel = data.time.peakHours
    .map((hour) => ({
      ...hour,
      label: formatLocalHour(hour.hourUtc, offsetMinutes),
    }))
    .filter((hour): hour is PeakHourLabel => hour.rate !== null)

  const intervalHighlight = data.retention.optimalInterval
    ? `${data.retention.optimalInterval.label} (${formatPercent(
        data.retention.optimalInterval.rate,
      )})`
    : NO_INTERVAL_HIGHLIGHT

  const forecastCounts = data.forecast.duePerDay.map((d) => d.count)
  const peakDayValue =
    forecastCounts.length === 0
      ? NO_INTERVAL_HIGHLIGHT
      : Math.max(...forecastCounts).toString()
  const hasHourlyPerformance = data.time.hourlyPerformance.some(
    (hour) => hour.total > 0,
  )
  const hasForecast = data.forecast.duePerDay.some((day) => day.count > 0)
  const totalReviews = data.retention.daily.reduce(
    (sum, day) => sum + day.total,
    0,
  )
  const recent7Reviews = data.retention.daily
    .slice(-7)
    .reduce((sum, day) => sum + day.total, 0)
  const recent14Reviews = data.retention.daily
    .slice(-14)
    .reduce((sum, day) => sum + day.total, 0)
  const hourlyRates = data.time.hourlyPerformance
    .map((hour) => hour.rate)
    .filter((rate): rate is number => rate !== null)
  const peakHourlyRate =
    hourlyRates.length > 0 ? Math.max(...hourlyRates) : null
  const retentionDelta7to30 =
    latest7 !== null && latest30 !== null
      ? roundToOne(latest7 - latest30)
      : null

  const cardTypeSampleFloor = getCardTypeSampleFloor(totalReviews)
  const cardTypeCandidates = data.retention.byCardType.filter(
    (item) => item.total >= cardTypeSampleFloor && item.rate !== null,
  )
  const { min: weakestCardType, max: strongestCardType } = findMinMaxBy(
    cardTypeCandidates,
    (item) => item.rate,
  )
  const cardTypeSpread =
    weakestCardType &&
    strongestCardType &&
    weakestCardType.rate !== null &&
    strongestCardType.rate !== null
      ? roundToOne(strongestCardType.rate - weakestCardType.rate)
      : null

  const intervalCandidates = data.retention.intervalBuckets.filter(
    (bucket) =>
      bucket.total >= INTERVAL_CANDIDATE_MIN_REVIEWS && bucket.rate !== null,
  )
  const { min: weakestIntervalBucket, max: bestIntervalBucket } = findMinMaxBy(
    intervalCandidates,
    (bucket) => bucket.rate,
  )
  const intervalSpread =
    weakestIntervalBucket &&
    bestIntervalBucket &&
    weakestIntervalBucket.rate !== null &&
    bestIntervalBucket.rate !== null
      ? roundToOne(bestIntervalBucket.rate - weakestIntervalBucket.rate)
      : null

  const hourlyCandidates = data.time.hourlyPerformance.filter(
    (hour) => hour.total >= HOURLY_CANDIDATE_MIN_REVIEWS && hour.rate !== null,
  )
  const { min: weakestHour, max: strongestHour } = findMinMaxBy(
    hourlyCandidates,
    (hour) => hour.rate,
  )
  const hourlySpread =
    strongestHour &&
    weakestHour &&
    strongestHour.rate !== null &&
    weakestHour.rate !== null
      ? roundToOne(strongestHour.rate - weakestHour.rate)
      : null

  const first7Due = data.forecast.duePerDay.slice(0, 7)
  const first7DueTotal = first7Due.reduce((sum, day) => sum + day.count, 0)
  const first7DailyAverage = safeAverage(first7Due.map((day) => day.count))
  const forecastPeakCount =
    forecastCounts.length === 0 ? 0 : Math.max(...forecastCounts)
  const forecastSpikeRatio =
    data.forecast.averagePerDay > 0
      ? forecastPeakCount / data.forecast.averagePerDay
      : 0
  const forecastSpikeDays = data.forecast.duePerDay.filter(
    (day) =>
      day.count >= getForecastSpikeDayThreshold(data.forecast.averagePerDay) &&
      data.forecast.averagePerDay > 0,
  ).length
  const first7Share =
    data.forecast.totalDueNext30 > 0
      ? first7DueTotal / data.forecast.totalDueNext30
      : 0

  const retentionSummary = hasReviews
    ? `Latest rolling retention is ${formatPercent(latest7)} for 7-day, ${formatPercent(latest30)} for 30-day, and ${formatPercent(latest90)} for 90-day performance.`
    : 'No retention trend data is available yet.'

  const difficultySummary =
    data.difficulty.total === 0
      ? 'No active cards are available for difficulty distribution.'
      : `${data.difficulty.total} active cards by bucket: ${data.difficulty.buckets
          .map((bucket) => `${bucket.label} ${bucket.count}`)
          .join(', ')}.`

  const hourlySummary = hasHourlyPerformance
    ? peakHoursLabel.length > 0
      ? `Best local hours are ${peakHoursLabel
          .slice(0, 3)
          .map((hour) => `${hour.label} at ${formatPercent(hour.rate)}`)
          .join(
            ', ',
          )}. Peak hourly retention is ${formatPercent(peakHourlyRate)}.`
      : `Hourly data is available but no peak hours can be highlighted. Peak hourly retention is ${formatPercent(peakHourlyRate)}.`
    : 'No hourly performance data is available yet.'

  const forecastSummary = hasForecast
    ? `In the next 30 days, ${data.forecast.totalDueNext30.toLocaleString()} cards are due, averaging ${data.forecast.averagePerDay.toFixed(1)} cards per day with a highest day of ${peakDayValue} cards.`
    : 'No upcoming review load is scheduled yet.'

  const retentionAction = getRetentionAction({
    hasReviews,
    latest7,
    latest30,
    retentionDelta7to30,
    recent7Reviews,
  })
  const trendsAction = getTrendsAction({
    weakestCardType,
    strongestCardType,
    cardTypeSpread,
  })
  const intervalAction = getIntervalAction({
    weakestIntervalBucket,
    bestIntervalBucket,
    intervalSpread,
    intervalHighlight,
  })
  const workloadAction = getWorkloadAction({
    hasHourlyPerformance,
    strongestHour,
    weakestHour,
    hourlySpread,
    peakHoursLabel,
    offsetMinutes,
  })
  const forecastAction = getForecastAction({
    hasForecast,
    forecastSpikeRatio,
    forecastPeakCount,
    averagePerDay: data.forecast.averagePerDay,
    first7Share,
    first7DailyAverage,
    forecastSpikeDays,
  })

  const isLowDataVolume =
    totalReviews < LOW_DATA_TOTAL_REVIEWS_THRESHOLD ||
    recent14Reviews < LOW_DATA_RECENT_14_DAY_REVIEWS_THRESHOLD
  const recommendationIndicator = isLowDataVolume
    ? 'low-data'
    : data.meta.reviewLogsTruncated
      ? 'latest-logs'
      : null

  const retentionTone = getRetentionTone({ hasReviews, latest7 })
  const trendsTone = getTrendsTone({ weakestCardType, cardTypeSpread })
  const intervalTone = getIntervalTone({
    weakestIntervalBucket,
    intervalSpread,
  })
  const workloadTone = getWorkloadTone({ hourlySpread, hasHourlyPerformance })
  const forecastTone = getForecastTone({ forecastSpikeRatio, first7Share })

  return {
    difficultySummary,
    forecastAction,
    forecastSummary,
    forecastTone,
    hasForecast,
    hasHourlyPerformance,
    hasReviews,
    hourlySummary,
    intervalAction,
    intervalHighlight,
    intervalTone,
    latest30,
    latest7,
    latest90,
    peakDayValue,
    peakHoursLabel,
    recommendationIndicator,
    retentionAction,
    retentionSummary,
    retentionTone,
    trendsAction,
    trendsTone,
    workloadAction,
    workloadTone,
  }
}

export function useDerivedAnalytics(
  data: AnalyticsDashboardData | undefined,
  offsetMinutes: number,
) {
  return useMemo(
    () => (data ? buildDerivedAnalytics(data, offsetMinutes) : null),
    [data, offsetMinutes],
  )
}
