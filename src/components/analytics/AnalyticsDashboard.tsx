import { useEffect, useMemo, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

  const retentionSeries = useMemo(
    () => ({
      seven: data.retention.daily.map((day) => day.rolling7),
      thirty: data.retention.daily.map((day) => day.rolling30),
      ninety: data.retention.daily.map((day) => day.rolling90),
    }),
    [data.retention.daily],
  )

  const forecastCounts = data.forecast.duePerDay.map((d) => d.count)
  const peakDayValue =
    forecastCounts.length === 0 ? '-' : Math.max(...forecastCounts).toString()

  return (
    <div className="mx-auto max-w-7xl">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
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
              <h1 className="text-lg font-semibold">Learning Analytics</h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="space-y-8 p-6 sm:p-8">
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Retention Curves</CardTitle>
              <CardDescription>
                7, 30, and 90-day rolling retention trends.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasReviews ? (
                <>
                  <RetentionChart series={retentionSeries} />
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <LegendItem label="7-day" className="bg-emerald-500" />
                    <LegendItem label="30-day" className="bg-sky-500" />
                    <LegendItem label="90-day" className="bg-amber-500" />
                  </div>
                </>
              ) : (
                <EmptyState message="No review data yet. Complete a few reviews to unlock retention curves." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Card Type Performance</CardTitle>
              <CardDescription>Retention by card format.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.retention.byCardType.length === 0 ? (
                <EmptyState message="No card type comparisons yet." />
              ) : (
                data.retention.byCardType.map((item) => (
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
                          'h-2 rounded-full transition-all',
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
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Optimal Review Intervals</CardTitle>
              <CardDescription>
                Best-performing scheduled intervals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                            'h-2 rounded-full transition-all',
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>
                FSRS difficulty scores across cards.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[176px_1fr] sm:items-center">
              {data.difficulty.total === 0 ? (
                <EmptyState message="No active cards yet." />
              ) : (
                <>
                  <DonutChart
                    total={data.difficulty.total}
                    segments={data.difficulty.buckets.map((bucket, index) => ({
                      label: bucket.label,
                      value: bucket.count,
                      color: difficultyColors[index],
                    }))}
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
                            style={{ backgroundColor: difficultyColors[index] }}
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
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Time Analytics</CardTitle>
              <CardDescription>
                Estimated study time based on review spacing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {data.time.hourlyPerformance.every((hour) => hour.total === 0) ? (
                <EmptyState message="No hourly patterns yet." />
              ) : (
                <>
                  <HourlyChart
                    data={data.time.hourlyPerformance}
                    offsetMinutes={offsetMinutes}
                  />
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
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>30-Day Forecast</CardTitle>
              <CardDescription>
                Cards due per day and expected workload.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              {data.forecast.duePerDay.every((day) => day.count === 0) ? (
                <EmptyState message="No upcoming reviews scheduled yet." />
              ) : (
                <ForecastChart data={data.forecast.duePerDay} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  variant = 'default',
}: {
  label: string
  value: string
  helper?: string
  variant?: 'default' | 'compact'
}) {
  return (
    <Card
      className={cn(
        'border-border/60 bg-card/80',
        variant === 'compact' && 'py-4',
      )}
    >
      <CardContent className="space-y-1 px-4">
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {helper ? (
          <div className="text-xs text-muted-foreground">{helper}</div>
        ) : null}
      </CardContent>
    </Card>
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
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
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
}: {
  series: {
    seven: Array<number | null>
    thirty: Array<number | null>
    ninety: Array<number | null>
  }
}) {
  const width = 640
  const height = 200
  const padding = 24

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
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        aria-label="Retention chart"
        role="img"
      >
        <g className="text-muted-foreground/40">
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
        <path
          d={buildPath(series.ninety)}
          fill="none"
          strokeWidth="2.5"
          className="stroke-amber-500"
        />
        <path
          d={buildPath(series.thirty)}
          fill="none"
          strokeWidth="2.5"
          className="stroke-sky-500"
        />
        <path
          d={buildPath(series.seven)}
          fill="none"
          strokeWidth="2.5"
          className="stroke-emerald-500"
        />
      </svg>
    </div>
  )
}

const difficultyColors = ['#34d399', '#38bdf8', '#facc15', '#fb923c', '#ef4444']

function getCardTypeLabel(cardType: string) {
  if (cardType in CARD_TYPE_LABELS) {
    return CARD_TYPE_LABELS[cardType as keyof typeof CARD_TYPE_LABELS]
  }
  return 'Other'
}

function DonutChart({
  total,
  segments,
}: {
  total: number
  segments: Array<{ label: string; value: number; color: string }>
}) {
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
        aria-label="Difficulty distribution"
      >
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
}: {
  data: Array<HourlyPerformance>
  offsetMinutes: number
}) {
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
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
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
                  'w-full rounded-md transition-all',
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
    </div>
  )
}

function ForecastChart({
  data,
}: {
  data: Array<{ date: number; count: number }>
}) {
  const maxCount = Math.max(1, ...data.map((day) => day.count))

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-end gap-1">
        {data.map((day, index) => (
          <div key={day.date} className="flex h-20 flex-1 items-end">
            <div
              className={cn(
                'w-full rounded-md transition-all',
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
    </div>
  )
}
