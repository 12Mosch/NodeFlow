import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  LineChart,
  PieChart,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { isDifficultyBucketLabel } from '../../../shared/analytics-buckets'
import {
  HOURLY_CANDIDATE_MIN_REVIEWS,
  INTERVAL_CANDIDATE_MIN_REVIEWS,
  LOW_DATA_RECENT_14_DAY_REVIEWS_THRESHOLD,
  LOW_DATA_TOTAL_REVIEWS_THRESHOLD,
  NO_INTERVAL_HIGHLIGHT,
  findMinMaxBy,
  formatLocalHour,
  formatPercent,
  getCardTypeLabel,
  getCardTypeSampleFloor,
  getForecastAction,
  getForecastSpikeDayThreshold,
  getForecastTone,
  getIntervalAction,
  getIntervalTone,
  getLocalMinutes,
  getRetentionAction,
  getRetentionTone,
  getTrendsAction,
  getTrendsTone,
  getWorkloadAction,
  getWorkloadTone,
  lastNonNull,
  roundToOne,
  safeAverage,
} from './suggestion-helpers'
import type { FunctionReturnType } from 'convex/server'
import type { DifficultyBucketLabel } from '../../../shared/analytics-buckets'
import type { HourlyPerformance, PeakHourLabel } from './suggestion-helpers'
import type { ReactNode } from 'react'
import {
  ActionSuggestionCard,
  AnalyticsBlockHeader,
  AnalyticsCard,
  AnalyticsSection,
  ChartFrame,
  MetricCard,
} from '@/components/analytics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { cn } from '@/lib/utils'

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return '0m'
  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatDurationShort(ms: number | null) {
  if (!ms || ms <= 0) return '—'
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))}s`
  return formatDuration(ms)
}

type AnalyticsDashboardData = FunctionReturnType<
  typeof api.cardStates.getAnalyticsDashboard
>
type DifficultyBucketCardsResult = FunctionReturnType<
  typeof api.cardStates.listCardsByDifficultyBucket
>
type RetentionSeriesKey = 'seven' | 'thirty' | 'ninety'
type DifficultyBucketCardItem =
  NonNullable<DifficultyBucketCardsResult>['cards'][number]

function toDifficultyBucketLabel(label: string): DifficultyBucketLabel | null {
  return isDifficultyBucketLabel(label) ? label : null
}

function useDerivedAnalytics(
  data: AnalyticsDashboardData | undefined,
  offsetMinutes: number,
) {
  return useMemo(() => {
    if (!data) return null

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
      forecastCounts.length === 0 ? '-' : Math.max(...forecastCounts).toString()
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
    const { min: weakestIntervalBucket, max: bestIntervalBucket } =
      findMinMaxBy(intervalCandidates, (bucket) => bucket.rate)
    const intervalSpread =
      weakestIntervalBucket &&
      bestIntervalBucket &&
      weakestIntervalBucket.rate !== null &&
      bestIntervalBucket.rate !== null
        ? roundToOne(bestIntervalBucket.rate - weakestIntervalBucket.rate)
        : null

    const hourlyCandidates = data.time.hourlyPerformance.filter(
      (hour) =>
        hour.total >= HOURLY_CANDIDATE_MIN_REVIEWS && hour.rate !== null,
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
        day.count >=
          getForecastSpikeDayThreshold(data.forecast.averagePerDay) &&
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
    const recommendationAction = isLowDataVolume ? (
      <Badge variant="secondary" className="text-[10px]">
        Low data confidence
      </Badge>
    ) : data.meta.reviewLogsTruncated ? (
      <Badge variant="secondary" className="text-[10px]">
        Based on latest logs
      </Badge>
    ) : null

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
      recommendationAction,
      retentionAction,
      retentionSummary,
      retentionTone,
      trendsAction,
      trendsTone,
      workloadAction,
      workloadTone,
    }
  }, [data, offsetMinutes])
}

export function AnalyticsDashboard() {
  const router = useRouter()
  const { data } = useSuspenseQuery(
    convexQuery(api.cardStates.getAnalyticsDashboard, {}),
  )
  const [selectedDifficultyBucket, setSelectedDifficultyBucket] =
    useState<DifficultyBucketLabel | null>(null)
  const [hoveredDifficultyBucket, setHoveredDifficultyBucket] =
    useState<DifficultyBucketLabel | null>(null)
  const [selectedRetentionSeries, setSelectedRetentionSeries] =
    useState<RetentionSeriesKey | null>(null)
  const [hoveredRetentionSeries, setHoveredRetentionSeries] =
    useState<RetentionSeriesKey | null>(null)
  const { data: difficultyBucketCards, isPending: isDifficultyCardsPending } =
    useQuery(
      convexQuery(
        api.cardStates.listCardsByDifficultyBucket,
        selectedDifficultyBucket
          ? {
              bucketLabel: selectedDifficultyBucket,
              limit: 20,
            }
          : 'skip',
      ),
    )

  // Compute timezone offset only on client to avoid hydration mismatch
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  useEffect(() => {
    // This setState after hydration is intentional to get client timezone
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffsetMinutes(new Date().getTimezoneOffset())
  }, [])

  const retentionSeries = useMemo(
    () =>
      data
        ? {
            seven: data.retention.daily.map((day) => day.rolling7),
            thirty: data.retention.daily.map((day) => day.rolling30),
            ninety: data.retention.daily.map((day) => day.rolling90),
          }
        : { seven: [], thirty: [], ninety: [] },
    [data],
  )

  const derived = useDerivedAnalytics(data, offsetMinutes)

  if (!data || !derived) return null

  const {
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
    recommendationAction,
    retentionAction,
    retentionSummary,
    retentionTone,
    trendsAction,
    trendsTone,
    workloadAction,
    workloadTone,
  } = derived
  const highlightedRetentionSeries =
    hoveredRetentionSeries ?? selectedRetentionSeries

  return (
    <div className="mx-auto max-w-7xl">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (window.history.length > 1) {
                  router.history.back()
                } else {
                  void router.navigate({ to: '/' })
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-500" />
              <h1 className="text-base font-semibold sm:text-lg">
                Learning Analytics
              </h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="space-y-10 p-6 sm:p-8">
        <AnalyticsSection
          title="Retention Snapshot"
          description="Rolling retention rates from your latest review activity."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="7-day retention"
              value={formatPercent(latest7)}
              helper="Rolling average"
            />
            <MetricCard
              label="30-day retention"
              value={formatPercent(latest30)}
              helper="Rolling average"
            />
            <MetricCard
              label="90-day retention"
              value={formatPercent(latest90)}
              helper="Rolling average"
            />
          </div>
          <ActionSuggestionCard
            tone={retentionTone}
            action={recommendationAction}
          >
            {retentionAction}
          </ActionSuggestionCard>
        </AnalyticsSection>

        <AnalyticsSection
          title="Retention Trends"
          description="Compare rolling curves and card-type outcomes."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <AnalyticsCard className="px-6 lg:col-span-2">
              <AnalyticsBlockHeader
                title="Retention Curves"
                description="7, 30, and 90-day rolling retention trends."
              />
              <ChartFrame
                caption="Shaded band highlights the 80-90% target zone; dashed line marks the 85% benchmark."
                legend={
                  <>
                    <LegendItem
                      label="7-day"
                      className="bg-emerald-500"
                      isInteractive
                      isActive={highlightedRetentionSeries === 'seven'}
                      isPressed={selectedRetentionSeries === 'seven'}
                      onPointerEnter={() => setHoveredRetentionSeries('seven')}
                      onPointerLeave={() => setHoveredRetentionSeries(null)}
                      onToggle={() =>
                        setSelectedRetentionSeries((current) =>
                          current === 'seven' ? null : 'seven',
                        )
                      }
                    />
                    <LegendItem
                      label="30-day"
                      className="bg-sky-500"
                      isInteractive
                      isActive={highlightedRetentionSeries === 'thirty'}
                      isPressed={selectedRetentionSeries === 'thirty'}
                      onPointerEnter={() => setHoveredRetentionSeries('thirty')}
                      onPointerLeave={() => setHoveredRetentionSeries(null)}
                      onToggle={() =>
                        setSelectedRetentionSeries((current) =>
                          current === 'thirty' ? null : 'thirty',
                        )
                      }
                    />
                    <LegendItem
                      label="90-day"
                      className="bg-amber-500"
                      isInteractive
                      isActive={highlightedRetentionSeries === 'ninety'}
                      isPressed={selectedRetentionSeries === 'ninety'}
                      onPointerEnter={() => setHoveredRetentionSeries('ninety')}
                      onPointerLeave={() => setHoveredRetentionSeries(null)}
                      onToggle={() =>
                        setSelectedRetentionSeries((current) =>
                          current === 'ninety' ? null : 'ninety',
                        )
                      }
                    />
                    <LegendItem
                      label="80-90% target zone"
                      className="border border-emerald-500/60 bg-emerald-500/25"
                    />
                    <LegendItem
                      label="85% benchmark"
                      className="bg-muted-foreground"
                    />
                  </>
                }
                isEmpty={!hasReviews}
                empty="No review data yet. Complete a few reviews to unlock retention curves."
              >
                <RetentionChart
                  series={retentionSeries}
                  summary={retentionSummary}
                  hoveredSeries={hoveredRetentionSeries}
                  selectedSeries={selectedRetentionSeries}
                  onSeriesHoverChange={setHoveredRetentionSeries}
                  onSeriesSelectChange={setSelectedRetentionSeries}
                />
              </ChartFrame>
            </AnalyticsCard>

            <AnalyticsCard className="px-6">
              <AnalyticsBlockHeader
                title="Card Type Performance"
                description="Retention by card format."
              />
              {data.retention.byCardType.length === 0 ? (
                <EmptyState message="No card type comparisons yet." />
              ) : (
                <div className="space-y-3">
                  {data.retention.byCardType.map((item) => (
                    <div key={item.cardType} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {getCardTypeLabel(item.cardType)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatPercent(item.rate)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-[width] motion-reduce:transition-none',
                            item.rate === null ? 'bg-muted-foreground/30' : '',
                            item.cardType === 'basic' && 'bg-zinc-500',
                            item.cardType === 'concept' && 'bg-violet-500',
                            item.cardType === 'descriptor' && 'bg-orange-500',
                            item.cardType === 'cloze' && 'bg-cyan-500',
                            item.cardType === 'unknown' && 'bg-slate-500',
                          )}
                          style={{
                            width: `${item.rate ?? 0}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.total} reviews
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AnalyticsCard>
          </div>
          <ActionSuggestionCard tone={trendsTone} action={recommendationAction}>
            {trendsAction}
          </ActionSuggestionCard>
        </AnalyticsSection>

        <AnalyticsSection
          title="Review Quality Drivers"
          description="Interval effectiveness and current difficulty mix."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsCard className="px-6">
              <AnalyticsBlockHeader
                title="Optimal Review Intervals"
                description="Best-performing scheduled intervals."
              />
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">
                      Suggested interval
                    </div>
                    <div className="text-sm font-semibold">
                      {intervalHighlight}
                    </div>
                  </div>
                  <Badge variant="secondary">Based on reviews</Badge>
                </div>

                {data.retention.intervalBuckets.every(
                  (bucket) => bucket.total === 0,
                ) ? (
                  <EmptyState message="Not enough interval history yet." />
                ) : (
                  <div className="space-y-3">
                    {data.retention.intervalBuckets.map((bucket) => (
                      <div key={bucket.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span>{bucket.label}</span>
                          <span className="text-muted-foreground">
                            {formatPercent(bucket.rate)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-2 rounded-full transition-[width] motion-reduce:transition-none',
                              bucket.rate === null
                                ? 'bg-muted-foreground/30'
                                : '',
                              bucket.rate !== null && bucket.rate >= 85
                                ? 'bg-emerald-500'
                                : '',
                              bucket.rate !== null &&
                                bucket.rate >= 70 &&
                                bucket.rate < 85
                                ? 'bg-sky-500'
                                : '',
                              bucket.rate !== null && bucket.rate < 70
                                ? 'bg-amber-500'
                                : '',
                            )}
                            style={{
                              width: `${bucket.rate ?? 0}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {bucket.total} reviews
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AnalyticsCard>

            <AnalyticsCard className="px-6">
              <AnalyticsBlockHeader
                title="Difficulty Distribution"
                description="FSRS difficulty scores across cards."
              />
              <div className="grid gap-4 sm:grid-cols-[176px_1fr] sm:items-center">
                {data.difficulty.total === 0 ? (
                  <EmptyState message="No active cards yet." />
                ) : (
                  <>
                    <DonutChart
                      total={data.difficulty.total}
                      segments={data.difficulty.buckets
                        .map((bucket, index) => {
                          const label = toDifficultyBucketLabel(bucket.label)
                          if (!label) return null
                          return {
                            label,
                            value: bucket.count,
                            color: getDifficultyColor(index),
                          }
                        })
                        .filter(
                          (
                            segment,
                          ): segment is {
                            label: DifficultyBucketLabel
                            value: number
                            color: string
                          } => segment !== null,
                        )}
                      summary={difficultySummary}
                      selectedLabel={selectedDifficultyBucket}
                      hoveredLabel={hoveredDifficultyBucket}
                      onSelectLabel={(label) => {
                        setSelectedDifficultyBucket((current) =>
                          current === label ? null : label,
                        )
                      }}
                      onHoverLabelChange={setHoveredDifficultyBucket}
                    />
                    <div className="space-y-2">
                      {data.difficulty.buckets.map((bucket, index) => (
                        <button
                          key={bucket.label}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1 text-sm transition-colors motion-reduce:transition-none',
                            (selectedDifficultyBucket !== null ||
                              hoveredDifficultyBucket !== null) &&
                              selectedDifficultyBucket !== bucket.label &&
                              hoveredDifficultyBucket !== bucket.label
                              ? 'opacity-45'
                              : 'opacity-100',
                            selectedDifficultyBucket === bucket.label
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                          onClick={() => {
                            const label = toDifficultyBucketLabel(bucket.label)
                            if (!label) return
                            setSelectedDifficultyBucket((current) =>
                              current === label ? null : label,
                            )
                          }}
                          onMouseEnter={() => {
                            const label = toDifficultyBucketLabel(bucket.label)
                            if (!label) return
                            setHoveredDifficultyBucket(label)
                          }}
                          onMouseLeave={() => setHoveredDifficultyBucket(null)}
                          onFocus={() => {
                            const label = toDifficultyBucketLabel(bucket.label)
                            if (!label) return
                            setHoveredDifficultyBucket(label)
                          }}
                          onBlur={() => setHoveredDifficultyBucket(null)}
                          aria-pressed={
                            selectedDifficultyBucket === bucket.label
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: getDifficultyColor(index),
                              }}
                            />
                            <span>{bucket.label}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {bucket.count}
                          </span>
                        </button>
                      ))}
                      <div className="pt-2 text-xs text-muted-foreground">
                        {data.difficulty.total} active cards
                      </div>
                    </div>
                  </>
                )}
              </div>
              {data.difficulty.total > 0 ? (
                <DifficultyBucketCardList
                  selectedBucket={selectedDifficultyBucket}
                  isPending={isDifficultyCardsPending}
                  result={difficultyBucketCards}
                  onClear={() => setSelectedDifficultyBucket(null)}
                />
              ) : null}
            </AnalyticsCard>
          </div>
          <ActionSuggestionCard
            tone={intervalTone}
            action={recommendationAction}
          >
            {intervalAction}
          </ActionSuggestionCard>
        </AnalyticsSection>

        <AnalyticsSection
          title="Workload Outlook"
          description="Time analytics and upcoming review demand."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <AnalyticsCard className="px-6">
              <AnalyticsBlockHeader
                title="Time Analytics"
                description="Estimated study time based on review spacing."
              />
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricInline
                    icon={<Clock className="h-4 w-4" />}
                    label="Avg time per card"
                    value={formatDurationShort(data.time.avgTimePerCardMs)}
                  />
                  <MetricInline
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Daily total"
                    value={formatDuration(data.time.totalStudyTimeMs.daily)}
                  />
                  <MetricInline
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Weekly total"
                    value={formatDuration(data.time.totalStudyTimeMs.weekly)}
                  />
                  <MetricInline
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Monthly total"
                    value={formatDuration(data.time.totalStudyTimeMs.monthly)}
                  />
                </div>

                <ChartFrame
                  caption="Local time buckets shown in your current timezone."
                  isEmpty={!hasHourlyPerformance}
                  empty="No hourly patterns yet."
                >
                  <HourlyChart
                    data={data.time.hourlyPerformance}
                    offsetMinutes={offsetMinutes}
                    summary={hourlySummary}
                  />
                </ChartFrame>

                {hasHourlyPerformance ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      Peak performance hours
                    </div>
                    {peakHoursLabel.length === 0 ? (
                      <div>Not enough data to highlight peaks.</div>
                    ) : (
                      peakHoursLabel.map((hour) => (
                        <div key={hour.hourUtc}>
                          {hour.label} · {formatPercent(hour.rate)} (
                          {hour.total} reviews)
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </AnalyticsCard>

            <AnalyticsCard className="px-6 lg:col-span-2">
              <AnalyticsBlockHeader
                title="30-Day Forecast"
                description="Cards due per day and expected workload."
              />
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard
                    label="Total due"
                    value={data.forecast.totalDueNext30.toLocaleString()}
                    helper="Next 30 days"
                    variant="compact"
                  />
                  <MetricCard
                    label="Avg per day"
                    value={data.forecast.averagePerDay.toFixed(1)}
                    helper="Next 30 days"
                    variant="compact"
                  />
                  <MetricCard
                    label="Highest day"
                    value={peakDayValue}
                    helper="Next 30 days"
                    variant="compact"
                  />
                </div>

                <ChartFrame
                  caption="Projected cards due each day for the next 30 days."
                  isEmpty={!hasForecast}
                  empty="No upcoming reviews scheduled yet."
                >
                  <ForecastChart
                    data={data.forecast.duePerDay}
                    summary={forecastSummary}
                  />
                </ChartFrame>
              </div>
            </AnalyticsCard>
          </div>
          <ActionSuggestionCard
            tone={workloadTone}
            action={recommendationAction}
          >
            {workloadAction}
          </ActionSuggestionCard>
          <ActionSuggestionCard
            tone={forecastTone}
            action={recommendationAction}
          >
            {forecastAction}
          </ActionSuggestionCard>
        </AnalyticsSection>
      </div>
    </div>
  )
}

function MetricInline({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <AnalyticsCard muted padding="compact" className="gap-2 px-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </AnalyticsCard>
  )
}

function LegendItem({
  label,
  className,
  isInteractive = false,
  isActive = false,
  isPressed = false,
  onPointerEnter,
  onPointerLeave,
  onToggle,
}: {
  label: string
  className: string
  isInteractive?: boolean
  isActive?: boolean
  isPressed?: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onToggle?: () => void
}) {
  if (!isInteractive) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', className)} />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-2 rounded-sm px-1.5 py-0.5 transition-colors motion-reduce:transition-none',
        isActive
          ? 'bg-muted/80 text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={isPressed}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={onPointerLeave}
      onClick={onToggle}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} />
      <span>{label}</span>
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function formatDueDateLabel(due: number) {
  if (due <= Date.now()) return 'Due now'
  return new Date(due).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDifficultyCardPreview(
  item: Pick<DifficultyBucketCardItem, 'cardState' | 'block'>,
) {
  if (item.block.cardType === 'cloze') {
    return item.block.cardFront || 'Cloze card'
  }

  const front = item.block.cardFront?.trim() || 'Front'
  const back = item.block.cardBack?.trim() || 'Back'
  return item.cardState.direction === 'forward'
    ? `${front} → ${back}`
    : `${back} → ${front}`
}

function DifficultyBucketCardList({
  selectedBucket,
  isPending,
  result,
  onClear,
}: {
  selectedBucket: DifficultyBucketLabel | null
  isPending: boolean
  result: DifficultyBucketCardsResult | undefined
  onClear: () => void
}) {
  if (!selectedBucket) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
        Click a difficulty slice to inspect cards in that bucket.
      </div>
    )
  }

  if (isPending || result === undefined) {
    return (
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 px-4 py-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (result === null || result.cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>No active cards found in difficulty {selectedBucket}.</span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filter
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground uppercase">
          Difficulty {result.bucketLabel} · Showing {result.cards.length} of{' '}
          {result.totalMatching}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filter
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border/70 text-muted-foreground">
            <tr className="text-left">
              <th className="px-2 py-2 font-medium">Card</th>
              <th className="px-2 py-2 font-medium">Document</th>
              <th className="px-2 py-2 font-medium">Difficulty</th>
              <th className="px-2 py-2 font-medium">Lapses</th>
              <th className="px-2 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {result.cards.map((item: DifficultyBucketCardItem) => (
              <tr key={item.cardState._id} className="align-top">
                <td className="max-w-64 px-2 py-2">
                  <div className="truncate font-medium">
                    {getDifficultyCardPreview(item)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.cardState.direction === 'forward'
                      ? 'Front → Back'
                      : 'Back → Front'}
                  </div>
                </td>
                <td className="max-w-44 px-2 py-2">
                  {item.document ? (
                    <Link
                      to="/doc/$docId"
                      params={{ docId: item.document._id }}
                      className="truncate text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {item.document.title}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">(Unknown)</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {item.cardState.difficulty.toFixed(1)}
                </td>
                <td className="px-2 py-2">{item.cardState.lapses}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {formatDueDateLabel(item.cardState.due)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RetentionChart({
  series,
  summary,
  hoveredSeries,
  selectedSeries,
  onSeriesHoverChange,
  onSeriesSelectChange,
}: {
  series: {
    seven: Array<number | null>
    thirty: Array<number | null>
    ninety: Array<number | null>
  }
  summary: string
  hoveredSeries: RetentionSeriesKey | null
  selectedSeries: RetentionSeriesKey | null
  onSeriesHoverChange: (series: RetentionSeriesKey | null) => void
  onSeriesSelectChange: (series: RetentionSeriesKey | null) => void
}) {
  const chartId = useId()
  const titleId = `${chartId}-title`
  const summaryId = `${chartId}-summary`
  const width = 640
  const height = 200
  const padding = 24
  const benchmark = 85
  const benchmarkY = padding + (1 - benchmark / 100) * (height - padding * 2)
  const targetTop = 90
  const targetBottom = 80
  const targetTopY = padding + (1 - targetTop / 100) * (height - padding * 2)
  const targetBottomY =
    padding + (1 - targetBottom / 100) * (height - padding * 2)
  const focusedSeries = hoveredSeries ?? selectedSeries
  const hasFocusedSeries = focusedSeries !== null

  const buildPath = (values: Array<number | null>) => {
    if (values.length === 0) return ''
    const step = (width - padding * 2) / Math.max(values.length - 1, 1)
    let path = ''
    let started = false

    values.forEach((value, index) => {
      if (value === null) {
        started = false
        return
      }
      const x = padding + step * index
      const y = padding + (1 - value / 100) * (height - padding * 2)
      if (!started) {
        path += `M ${x} ${y}`
        started = true
      } else {
        path += ` L ${x} ${y}`
      }
    })

    return path
  }

  const getPathState = (key: RetentionSeriesKey) => {
    const isActive = focusedSeries === key
    const isDimmed = hasFocusedSeries && !isActive
    return {
      isActive,
      isDimmed,
      strokeWidth: isActive ? 3 : 2.3,
    }
  }

  const toggleSeries = (key: RetentionSeriesKey) => {
    onSeriesSelectChange(selectedSeries === key ? null : key)
  }

  const seriesConfigs: Array<{
    key: RetentionSeriesKey
    values: Array<number | null>
    strokeClassName: string
    ariaLabel: string
  }> = [
    {
      key: 'ninety',
      values: series.ninety,
      strokeClassName: 'stroke-amber-500',
      ariaLabel: '90-day retention',
    },
    {
      key: 'thirty',
      values: series.thirty,
      strokeClassName: 'stroke-sky-500',
      ariaLabel: '30-day retention',
    },
    {
      key: 'seven',
      values: series.seven,
      strokeClassName: 'stroke-emerald-500',
      ariaLabel: '7-day retention',
    },
  ]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      role="img"
      aria-labelledby={`${titleId} ${summaryId}`}
    >
      <title id={titleId}>Retention chart</title>
      <desc id={summaryId}>{summary}</desc>
      <rect
        x={padding}
        y={targetTopY}
        width={width - padding * 2}
        height={targetBottomY - targetTopY}
        className="fill-emerald-500/20"
      />
      <g className="text-muted-foreground/35">
        {[0, 25, 50, 75, 100].map((value) => {
          const y = padding + (1 - value / 100) * (height - padding * 2)
          return (
            <line
              key={value}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          )
        })}
      </g>
      <line
        x1={padding}
        x2={width - padding}
        y1={benchmarkY}
        y2={benchmarkY}
        stroke="currentColor"
        className="text-muted-foreground/70"
        strokeDasharray="6 4"
        strokeWidth="1"
      />
      {seriesConfigs.map((seriesConfig) => {
        const pathState = getPathState(seriesConfig.key)
        return (
          <path
            key={seriesConfig.key}
            d={buildPath(seriesConfig.values)}
            fill="none"
            strokeWidth={pathState.strokeWidth}
            className={cn(
              `${seriesConfig.strokeClassName} transition-[opacity,stroke-width] motion-reduce:transition-none`,
              pathState.isDimmed ? 'opacity-35' : 'opacity-90',
            )}
            tabIndex={0}
            role="button"
            aria-label={seriesConfig.ariaLabel}
            onMouseEnter={() => onSeriesHoverChange(seriesConfig.key)}
            onMouseLeave={() => onSeriesHoverChange(null)}
            onFocus={() => onSeriesHoverChange(seriesConfig.key)}
            onBlur={() => onSeriesHoverChange(null)}
            onClick={() => toggleSeries(seriesConfig.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleSeries(seriesConfig.key)
              }
            }}
          />
        )
      })}
    </svg>
  )
}

const difficultyColors = ['#34d399', '#38bdf8', '#facc15', '#fb923c', '#ef4444']

function getDifficultyColor(index: number) {
  return (
    difficultyColors[index] ?? difficultyColors[difficultyColors.length - 1]
  )
}

function DonutChart({
  total,
  segments,
  summary,
  selectedLabel,
  hoveredLabel,
  onSelectLabel,
  onHoverLabelChange,
}: {
  total: number
  segments: Array<{
    label: DifficultyBucketLabel
    value: number
    color: string
  }>
  summary: string
  selectedLabel: DifficultyBucketLabel | null
  hoveredLabel: DifficultyBucketLabel | null
  onSelectLabel: (label: DifficultyBucketLabel) => void
  onHoverLabelChange: (label: DifficultyBucketLabel | null) => void
}) {
  const chartId = useId()
  const titleId = `${chartId}-title`
  const summaryId = `${chartId}-summary`
  const radius = 44
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius
  const highlightedLabel = hoveredLabel ?? selectedLabel
  const segmentData = segments.reduce(
    (acc, segment) => {
      const fraction = total > 0 ? segment.value / total : 0
      const dash = fraction * circumference
      const entry = {
        ...segment,
        dash,
        offset: acc.offset,
      }
      return {
        offset: acc.offset + dash,
        entries: [...acc.entries, entry],
      }
    },
    {
      offset: 0,
      entries: [] as Array<{
        label: DifficultyBucketLabel
        value: number
        color: string
        dash: number
        offset: number
      }>,
    },
  ).entries

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <PieChart className="absolute top-3 right-3 h-5 w-5 text-muted-foreground/60" />
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        role="img"
        aria-labelledby={`${titleId} ${summaryId}`}
      >
        <title id={titleId}>Difficulty distribution chart</title>
        <desc id={summaryId}>{summary}</desc>
        <g transform="rotate(-90 60 60)">
          {segmentData.map((segment) => {
            const strokeDasharray = `${segment.dash} ${
              circumference - segment.dash
            }`
            const strokeDashoffset = -segment.offset
            const isActive = highlightedLabel === segment.label
            const isDimmed = highlightedLabel !== null && !isActive
            const canInteract = segment.value > 0
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={isActive ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  'transition-[opacity,stroke-width] motion-reduce:transition-none',
                  isDimmed ? 'opacity-35' : 'opacity-80',
                  canInteract
                    ? 'cursor-pointer focus-visible:outline-none'
                    : '',
                )}
                tabIndex={canInteract ? 0 : -1}
                role={canInteract ? 'button' : undefined}
                aria-label={`${segment.label} difficulty bucket`}
                aria-pressed={selectedLabel === segment.label}
                onClick={() => {
                  if (!canInteract) return
                  onSelectLabel(segment.label)
                }}
                onMouseEnter={() => {
                  if (!canInteract) return
                  onHoverLabelChange(segment.label)
                }}
                onMouseLeave={() => onHoverLabelChange(null)}
                onFocus={() => {
                  if (!canInteract) return
                  onHoverLabelChange(segment.label)
                }}
                onBlur={() => onHoverLabelChange(null)}
                onKeyDown={(event) => {
                  if (!canInteract) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectLabel(segment.label)
                  }
                }}
              />
            )
          })}
        </g>
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold">{total}</div>
        <div className="text-xs text-muted-foreground uppercase">Cards</div>
      </div>
    </div>
  )
}

function HourlyChart({
  data,
  offsetMinutes,
  summary,
}: {
  data: Array<HourlyPerformance>
  offsetMinutes: number
  summary: string
}) {
  const chartId = useId()
  const summaryId = `${chartId}-summary`
  const orderedData = data
    .map((hour) => ({
      ...hour,
      localMinutes: getLocalMinutes(hour.hourUtc, offsetMinutes),
    }))
    .sort((a, b) => a.localMinutes - b.localMinutes)
  const maxRate = Math.max(
    1,
    ...orderedData.map((hour) => (hour.rate === null ? 0 : hour.rate)),
  )
  const tickLabels =
    orderedData.length === 0
      ? ['0:00', '6:00', '12:00', '18:00', '0:00']
      : [0, 1, 2, 3, 4].map((i) => {
          // Last tick wraps to first hour to close the 24-hour cycle
          const raw = i < 4 ? Math.round((i / 4) * (orderedData.length - 1)) : 0
          const index = Math.min(raw, orderedData.length - 1)
          return formatLocalHour(
            orderedData[index].hourUtc,
            offsetMinutes,
            true,
          )
        })

  return (
    <div
      role="img"
      aria-label="Hourly performance chart"
      aria-describedby={summaryId}
    >
      <div className="flex items-end gap-1">
        {orderedData.map((hour) => {
          const height = hour.rate === null ? 0 : (hour.rate / maxRate) * 100
          return (
            <div
              key={hour.hourUtc}
              className="flex h-20 flex-1 items-end"
              title={`${formatLocalHour(hour.hourUtc, offsetMinutes)} · ${formatPercent(
                hour.rate,
              )}`}
            >
              <div
                className={cn(
                  'w-full rounded-md transition-[height] motion-reduce:transition-none',
                  hour.rate === null
                    ? 'bg-muted-foreground/30'
                    : 'bg-emerald-500',
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {tickLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
    </div>
  )
}

function ForecastChart({
  data,
  summary,
}: {
  data: Array<{ date: number; count: number }>
  summary: string
}) {
  const chartId = useId()
  const summaryId = `${chartId}-summary`
  const maxCount = Math.max(1, ...data.map((day) => day.count))

  return (
    <div
      role="img"
      aria-label="30-day forecast chart"
      aria-describedby={summaryId}
    >
      <div className="flex items-end gap-1">
        {data.map((day, index) => (
          <div key={day.date} className="flex h-20 flex-1 items-end">
            <div
              className={cn(
                'w-full rounded-md transition-[height] motion-reduce:transition-none',
                day.count === 0 ? 'bg-muted-foreground/30' : 'bg-indigo-500',
              )}
              style={{ height: `${(day.count / maxCount) * 100}%` }}
              title={`Day ${index + 1}: ${day.count} due`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>Day 1</span>
        <span>Day 15</span>
        <span>Day 30</span>
      </div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
    </div>
  )
}
