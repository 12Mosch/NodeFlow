import { useEffect, useId, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  LineChart,
  PieChart,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { ReactNode } from 'react'
import {
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
import { CARD_TYPE_LABELS } from '@/components/flashcards/constants'

type RetentionPoint = {
  date: number
  total: number
  correct: number
  rate: number | null
  rolling7: number | null
  rolling30: number | null
  rolling90: number | null
}

type HourlyPerformance = {
  hourUtc: number
  total: number
  rate: number | null
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

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

function getLocalMinutes(hourUtc: number, offsetMinutes: number) {
  return (((hourUtc * 60 - offsetMinutes) % 1440) + 1440) % 1440
}

function lastNonNull(points: Array<RetentionPoint>, key: keyof RetentionPoint) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i][key]
    if (typeof value === 'number') return value
  }
  return null
}

function formatLocalHour(
  hourUtc: number,
  offsetMinutes: number,
  compact = false,
) {
  const totalMinutes = getLocalMinutes(hourUtc, offsetMinutes)
  const hour = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  const minutePart = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`
  if (compact) {
    const compactMeridiem = meridiem === 'AM' ? 'a' : 'p'
    return `${displayHour}${minutePart}${compactMeridiem}`
  }
  return `${displayHour}${minutePart} ${meridiem}`
}

export function AnalyticsDashboard() {
  const router = useRouter()
  const { data } = useSuspenseQuery(
    convexQuery(api.cardStates.getAnalyticsDashboard, {}),
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
    .filter((hour) => hour.rate !== null)

  const intervalHighlight = data.retention.optimalInterval
    ? `${data.retention.optimalInterval.label} (${formatPercent(
        data.retention.optimalInterval.rate,
      )})`
    : '—'

  const forecastCounts = data.forecast.duePerDay.map((d) => d.count)
  const peakDayValue =
    forecastCounts.length === 0 ? '-' : Math.max(...forecastCounts).toString()
  const hasHourlyPerformance = data.time.hourlyPerformance.some(
    (hour) => hour.total > 0,
  )
  const hasForecast = data.forecast.duePerDay.some((day) => day.count > 0)
  const hourlyRates = data.time.hourlyPerformance
    .map((hour) => hour.rate)
    .filter((rate): rate is number => rate !== null)
  const peakHourlyRate =
    hourlyRates.length > 0 ? Math.max(...hourlyRates) : null

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
                caption="Dashed reference line marks the 85% benchmark."
                legend={
                  <>
                    <LegendItem label="7-day" className="bg-emerald-500" />
                    <LegendItem label="30-day" className="bg-sky-500" />
                    <LegendItem label="90-day" className="bg-amber-500" />
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
                      segments={data.difficulty.buckets.map(
                        (bucket, index) => ({
                          label: bucket.label,
                          value: bucket.count,
                          color: getDifficultyColor(index),
                        }),
                      )}
                      summary={difficultySummary}
                    />
                    <div className="space-y-2">
                      {data.difficulty.buckets.map((bucket, index) => (
                        <div
                          key={bucket.label}
                          className="flex items-center justify-between text-sm"
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
                        </div>
                      ))}
                      <div className="pt-2 text-xs text-muted-foreground">
                        {data.difficulty.total} active cards
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AnalyticsCard>
          </div>
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
}: {
  label: string
  className: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} />
      <span>{label}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function RetentionChart({
  series,
  summary,
}: {
  series: {
    seven: Array<number | null>
    thirty: Array<number | null>
    ninety: Array<number | null>
  }
  summary: string
}) {
  const chartId = useId()
  const titleId = `${chartId}-title`
  const summaryId = `${chartId}-summary`
  const width = 640
  const height = 200
  const padding = 24
  const benchmark = 85
  const benchmarkY = padding + (1 - benchmark / 100) * (height - padding * 2)

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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      role="img"
      aria-labelledby={`${titleId} ${summaryId}`}
    >
      <title id={titleId}>Retention chart</title>
      <desc id={summaryId}>{summary}</desc>
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
      <path
        d={buildPath(series.ninety)}
        fill="none"
        strokeWidth="2"
        className="stroke-amber-500"
      />
      <path
        d={buildPath(series.thirty)}
        fill="none"
        strokeWidth="2"
        className="stroke-sky-500"
      />
      <path
        d={buildPath(series.seven)}
        fill="none"
        strokeWidth="2"
        className="stroke-emerald-500"
      />
    </svg>
  )
}

const difficultyColors = ['#34d399', '#38bdf8', '#facc15', '#fb923c', '#ef4444']

function getDifficultyColor(index: number) {
  return (
    difficultyColors[index] ?? difficultyColors[difficultyColors.length - 1]
  )
}

function getCardTypeLabel(cardType: string) {
  if (cardType in CARD_TYPE_LABELS) {
    return CARD_TYPE_LABELS[cardType as keyof typeof CARD_TYPE_LABELS]
  }
  return 'Other'
}

function DonutChart({
  total,
  segments,
  summary,
}: {
  total: number
  segments: Array<{ label: string; value: number; color: string }>
  summary: string
}) {
  const chartId = useId()
  const titleId = `${chartId}-title`
  const summaryId = `${chartId}-summary`
  const radius = 44
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius
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
        label: string
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
            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
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
