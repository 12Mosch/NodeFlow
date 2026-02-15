import type { api } from '../../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { PeakHourLabel, SuggestionTone } from '../suggestion-helpers'

export type AnalyticsDashboardData = FunctionReturnType<
  typeof api.cardStates.getAnalyticsDashboard
>
export type AnalyticsDashboardDataValue = NonNullable<AnalyticsDashboardData>

export type DifficultyBucketCardsResult = FunctionReturnType<
  typeof api.cardStates.listCardsByDifficultyBucket
>

export type DifficultyBucketCardItem =
  NonNullable<DifficultyBucketCardsResult>['cards'][number]

export type RetentionSeriesKey = 'seven' | 'thirty' | 'ninety'

export type RetentionSeries = {
  seven: Array<number | null>
  thirty: Array<number | null>
  ninety: Array<number | null>
}

export type RecommendationIndicator = 'low-data' | 'latest-logs' | null

export interface DerivedAnalytics {
  difficultySummary: string
  forecastAction: string
  forecastSummary: string
  forecastTone: SuggestionTone
  hasForecast: boolean
  hasHourlyPerformance: boolean
  hasReviews: boolean
  hourlySummary: string
  intervalAction: string
  intervalHighlight: string
  intervalTone: SuggestionTone
  latest30: number | null
  latest7: number | null
  latest90: number | null
  peakDayValue: string
  peakHoursLabel: Array<PeakHourLabel>
  recommendationIndicator: RecommendationIndicator
  retentionAction: string
  retentionSummary: string
  retentionTone: SuggestionTone
  trendsAction: string
  trendsTone: SuggestionTone
  workloadAction: string
  workloadTone: SuggestionTone
}
