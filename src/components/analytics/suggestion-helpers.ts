import { CARD_TYPE_LABELS } from '@/components/flashcards/constants'

export type RetentionPoint = {
  date: number
  total: number
  correct: number
  rate: number | null
  rolling7: number | null
  rolling30: number | null
  rolling90: number | null
}

export type HourlyPerformance = {
  hourUtc: number
  total: number
  rate: number | null
}

export type CardTypePerformance = {
  cardType: string
  total: number
  rate: number | null
}

export type IntervalPerformanceBucket = {
  label: string
  total: number
  rate: number | null
}

export type PeakHourLabel = {
  hourUtc: number
  total: number
  rate: number
  label: string
}

export type SuggestionTone = 'default' | 'warning' | 'success'

export const NO_INTERVAL_HIGHLIGHT = '—'
const CARD_TYPE_HIGH_VOLUME_THRESHOLD = 250
const CARD_TYPE_SAMPLE_FLOOR_HIGH = 20
const CARD_TYPE_SAMPLE_FLOOR_LOW = 12
export const INTERVAL_CANDIDATE_MIN_REVIEWS = 12
export const HOURLY_CANDIDATE_MIN_REVIEWS = 5

const RETENTION_CRITICAL_THRESHOLD = 75
const RETENTION_WARNING_THRESHOLD = 80
const RETENTION_STRONG_THRESHOLD = 88
const RETENTION_CRITICAL_DELTA_THRESHOLD = -6
const RETENTION_BASELINE_DELTA_THRESHOLD = -4
const RETENTION_STABLE_DELTA_THRESHOLD = 0
const RETENTION_STRONG_MIN_RECENT_REVIEWS = 40
const RETENTION_WEEKLY_CHECK_TARGET = 85

const TRENDS_CRITICAL_RATE_THRESHOLD = 78
const TRENDS_WARNING_RATE_THRESHOLD = 80
const TRENDS_LARGE_SPREAD_THRESHOLD = 8
const TRENDS_BALANCED_SPREAD_THRESHOLD = 4

const INTERVAL_EARLY_BUCKET_LABEL = '0-1d'
const INTERVAL_EARLY_BUCKET_WARNING_THRESHOLD = 70
const INTERVAL_WARNING_THRESHOLD = 75
const INTERVAL_SPREAD_ACTION_THRESHOLD = 10
const INTERVAL_SPREAD_SUCCESS_THRESHOLD = 6

const WORKLOAD_ACTION_SPREAD_THRESHOLD = 10
const WORKLOAD_TONE_SPREAD_THRESHOLD = WORKLOAD_ACTION_SPREAD_THRESHOLD

const FORECAST_SPIKE_DAY_MIN_COUNT = 10
const FORECAST_SPIKE_DAY_RATIO_THRESHOLD = 1.5
const FORECAST_ACTION_SPIKE_RATIO_THRESHOLD = 2
const FORECAST_ACTION_SPIKE_COUNT_THRESHOLD = 25
const FORECAST_FIRST_WEEK_SHARE_WARNING_THRESHOLD = 0.4
const FORECAST_HEAVY_DAY_COUNT_THRESHOLD = 3
const FORECAST_EXTRA_DAILY_CARDS_MIN = 3
const FORECAST_EXTRA_DAILY_CARDS_WINDOW_DAYS = 7

export const LOW_DATA_TOTAL_REVIEWS_THRESHOLD = 60
export const LOW_DATA_RECENT_14_DAY_REVIEWS_THRESHOLD = 25

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

export function formatDuration(ms: number) {
  if (!ms || ms <= 0) return '0m'
  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function formatDurationShort(ms: number | null) {
  if (!ms || ms <= 0) return '—'
  const roundedSeconds = Math.max(1, Math.round(ms / 1000))
  if (roundedSeconds < 60) return `${roundedSeconds}s`
  return formatDuration(ms)
}

export function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

export function safeAverage(values: Array<number>) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function getLocalMinutes(hourUtc: number, offsetMinutes: number) {
  return (((hourUtc * 60 - offsetMinutes) % 1440) + 1440) % 1440
}

export function lastNonNull(
  points: Array<RetentionPoint>,
  key: keyof RetentionPoint,
) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i][key]
    if (typeof value === 'number') return value
  }
  return null
}

export function findMinMaxBy<T>(
  items: Array<T>,
  getValue: (item: T) => number | null | undefined,
) {
  const result = items.reduce(
    (acc, item) => {
      const value = getValue(item)
      if (value === null || value === undefined || Number.isNaN(value)) {
        return acc
      }

      if (value < acc.minValue) {
        acc.min = item
        acc.minValue = value
      }

      if (value > acc.maxValue) {
        acc.max = item
        acc.maxValue = value
      }

      return acc
    },
    {
      min: undefined as T | undefined,
      max: undefined as T | undefined,
      minValue: Number.POSITIVE_INFINITY,
      maxValue: Number.NEGATIVE_INFINITY,
    },
  )

  return { min: result.min, max: result.max }
}

export function formatLocalHour(
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

export function getCardTypeLabel(cardType: string) {
  if (cardType in CARD_TYPE_LABELS) {
    return CARD_TYPE_LABELS[cardType as keyof typeof CARD_TYPE_LABELS]
  }
  return 'Other'
}

export function getCardTypeSampleFloor(totalReviews: number) {
  if (totalReviews >= CARD_TYPE_HIGH_VOLUME_THRESHOLD) {
    return CARD_TYPE_SAMPLE_FLOOR_HIGH
  }
  return CARD_TYPE_SAMPLE_FLOOR_LOW
}

export function getForecastSpikeDayThreshold(averagePerDay: number) {
  return Math.max(
    FORECAST_SPIKE_DAY_MIN_COUNT,
    averagePerDay * FORECAST_SPIKE_DAY_RATIO_THRESHOLD,
  )
}

export function getRetentionAction({
  hasReviews,
  latest7,
  latest30,
  retentionDelta7to30,
  recent7Reviews,
}: {
  hasReviews: boolean
  latest7: number | null
  latest30: number | null
  retentionDelta7to30: number | null
  recent7Reviews: number
}) {
  if (!hasReviews) {
    return 'Complete a focused review set today to unlock retention guidance.'
  }

  if (latest7 === null) {
    return 'Recent retention is still stabilizing. Add 2-3 short sessions this week so trends become reliable.'
  }

  if (
    latest7 < RETENTION_CRITICAL_THRESHOLD &&
    retentionDelta7to30 !== null &&
    retentionDelta7to30 <= RETENTION_CRITICAL_DELTA_THRESHOLD
  ) {
    return `Short-term retention is slipping (${formatPercent(latest7)} vs ${formatPercent(latest30)} 30-day baseline). Pause new cards for 3 days and clear due cards before adding more.`
  }

  if (latest7 < RETENTION_WARNING_THRESHOLD) {
    return `7-day retention is ${formatPercent(latest7)}. Add one extra recovery block daily and rewrite cards you miss twice in a row.`
  }

  if (
    retentionDelta7to30 !== null &&
    retentionDelta7to30 <= RETENTION_BASELINE_DELTA_THRESHOLD
  ) {
    return `Recent retention is ${Math.abs(retentionDelta7to30).toFixed(1)} points below your 30-day baseline. Bring hard cards one interval earlier this week.`
  }

  if (
    latest7 >= RETENTION_STRONG_THRESHOLD &&
    (retentionDelta7to30 === null ||
      retentionDelta7to30 >= RETENTION_STABLE_DELTA_THRESHOLD) &&
    recent7Reviews >= RETENTION_STRONG_MIN_RECENT_REVIEWS
  ) {
    return `Retention is strong at ${formatPercent(latest7)}. You can increase new-card intake slightly while keeping weekly checks above ${RETENTION_WEEKLY_CHECK_TARGET}%.`
  }

  return `Retention is steady at ${formatPercent(latest7)}. Keep daily consistency and prioritize cards missed more than once.`
}

export function getTrendsAction({
  weakestCardType,
  strongestCardType,
  cardTypeSpread,
}: {
  weakestCardType: CardTypePerformance | undefined
  strongestCardType: CardTypePerformance | undefined
  cardTypeSpread: number | null
}) {
  if (
    weakestCardType &&
    strongestCardType &&
    weakestCardType.rate !== null &&
    strongestCardType.rate !== null &&
    cardTypeSpread !== null &&
    weakestCardType.rate < TRENDS_CRITICAL_RATE_THRESHOLD &&
    cardTypeSpread >= TRENDS_LARGE_SPREAD_THRESHOLD
  ) {
    return `${getCardTypeLabel(weakestCardType.cardType)} cards trail ${getCardTypeLabel(
      strongestCardType.cardType,
    )} by ${cardTypeSpread.toFixed(1)} points (${formatPercent(
      weakestCardType.rate,
    )} vs ${formatPercent(strongestCardType.rate)}). Rewrite that format first and simplify prompts.`
  }

  if (
    weakestCardType &&
    weakestCardType.rate !== null &&
    weakestCardType.rate < TRENDS_WARNING_RATE_THRESHOLD
  ) {
    return `${getCardTypeLabel(weakestCardType.cardType)} cards are underperforming at ${formatPercent(weakestCardType.rate)}. Tighten wording and reduce multi-step recall in those cards.`
  }

  if (
    cardTypeSpread !== null &&
    cardTypeSpread <= TRENDS_BALANCED_SPREAD_THRESHOLD
  ) {
    return `Card-type performance is balanced (spread ${cardTypeSpread.toFixed(1)} points). Keep current templates and watch for drift as volume grows.`
  }

  return 'No major card-type weakness detected. Use this view to catch format regressions early.'
}

export function getIntervalAction({
  weakestIntervalBucket,
  bestIntervalBucket,
  intervalSpread,
  intervalHighlight,
}: {
  weakestIntervalBucket: IntervalPerformanceBucket | undefined
  bestIntervalBucket: IntervalPerformanceBucket | undefined
  intervalSpread: number | null
  intervalHighlight: string
}) {
  if (
    weakestIntervalBucket &&
    weakestIntervalBucket.rate !== null &&
    bestIntervalBucket &&
    bestIntervalBucket.rate !== null &&
    intervalSpread !== null &&
    weakestIntervalBucket.label === INTERVAL_EARLY_BUCKET_LABEL &&
    weakestIntervalBucket.rate < INTERVAL_EARLY_BUCKET_WARNING_THRESHOLD
  ) {
    return `Early relearning is weak (${formatPercent(weakestIntervalBucket.rate)} in ${INTERVAL_EARLY_BUCKET_LABEL}). This is usually a card-quality issue, so simplify prompts before changing schedule spacing.`
  }

  if (
    weakestIntervalBucket &&
    weakestIntervalBucket.rate !== null &&
    weakestIntervalBucket.rate < INTERVAL_WARNING_THRESHOLD &&
    weakestIntervalBucket.label !== INTERVAL_EARLY_BUCKET_LABEL &&
    intervalSpread !== null &&
    intervalSpread >= INTERVAL_SPREAD_ACTION_THRESHOLD
  ) {
    return `Retention drops in ${weakestIntervalBucket.label} (${formatPercent(
      weakestIntervalBucket.rate,
    )}), ${intervalSpread.toFixed(
      1,
    )} points behind your best interval. Pull those cards one interval earlier.`
  }

  if (intervalHighlight !== NO_INTERVAL_HIGHLIGHT) {
    return `Your strongest interval is ${intervalHighlight}. Keep difficult cards near this range and expand only when recent retention stays stable.`
  }

  return 'Build more interval history to unlock stronger scheduling recommendations.'
}

export function getWorkloadAction({
  hasHourlyPerformance,
  strongestHour,
  weakestHour,
  hourlySpread,
  peakHoursLabel,
  offsetMinutes,
}: {
  hasHourlyPerformance: boolean
  strongestHour: HourlyPerformance | undefined
  weakestHour: HourlyPerformance | undefined
  hourlySpread: number | null
  peakHoursLabel: Array<PeakHourLabel>
  offsetMinutes: number
}) {
  if (!hasHourlyPerformance) {
    return 'Log a few more sessions this week to reveal your best study hours.'
  }

  if (
    strongestHour &&
    weakestHour &&
    strongestHour.rate !== null &&
    weakestHour.rate !== null &&
    hourlySpread !== null &&
    hourlySpread >= WORKLOAD_ACTION_SPREAD_THRESHOLD
  ) {
    return `Your best hour (${formatLocalHour(
      strongestHour.hourUtc,
      offsetMinutes,
    )}, ${formatPercent(strongestHour.rate)}) beats your weakest window by ${hourlySpread.toFixed(
      1,
    )} points. Schedule hard cards in that high-performance window.`
  }

  if (peakHoursLabel.length > 0) {
    return `Performance is fairly consistent by time of day. Keep difficult reviews around ${peakHoursLabel[0].label} and use short maintenance sessions elsewhere.`
  }

  return 'Hourly performance is still sparse. Continue steady daily sessions to identify a best-time pattern.'
}

export function getForecastAction({
  hasForecast,
  forecastSpikeRatio,
  forecastPeakCount,
  averagePerDay,
  first7Share,
  first7DailyAverage,
  forecastSpikeDays,
}: {
  hasForecast: boolean
  forecastSpikeRatio: number
  forecastPeakCount: number
  averagePerDay: number
  first7Share: number
  first7DailyAverage: number
  forecastSpikeDays: number
}) {
  if (!hasForecast) {
    return 'No backlog forecast yet. Keep up daily reviews to prevent future spikes.'
  }

  if (
    forecastSpikeRatio >= FORECAST_ACTION_SPIKE_RATIO_THRESHOLD &&
    forecastPeakCount >= FORECAST_ACTION_SPIKE_COUNT_THRESHOLD
  ) {
    return `Workload spike detected: highest day is ${forecastPeakCount} cards (${forecastSpikeRatio.toFixed(
      1,
    )}x your daily average). Add ${Math.max(
      FORECAST_EXTRA_DAILY_CARDS_MIN,
      Math.ceil(
        (forecastPeakCount - averagePerDay) /
          FORECAST_EXTRA_DAILY_CARDS_WINDOW_DAYS,
      ),
    )} extra cards/day this week to flatten the peak.`
  }

  if (
    first7Share >= FORECAST_FIRST_WEEK_SHARE_WARNING_THRESHOLD &&
    first7DailyAverage > averagePerDay
  ) {
    return `${Math.round(
      first7Share * 100,
    )}% of your 30-day workload lands in the next 7 days. Front-load short sessions now to avoid an early backlog.`
  }

  if (forecastSpikeDays >= FORECAST_HEAVY_DAY_COUNT_THRESHOLD) {
    return `Your next month has ${forecastSpikeDays} heavy days. Keep a small buffer session on light days to smooth the queue.`
  }

  const peakPhrase =
    forecastPeakCount <= 0
      ? ''
      : forecastPeakCount === 1
        ? ' (1 card)'
        : ` (${forecastPeakCount.toLocaleString()} cards)`

  return `Upcoming load is manageable. Protect consistency and pre-review ahead of your highest day${peakPhrase}.`
}

export function getRetentionTone({
  hasReviews,
  latest7,
}: {
  hasReviews: boolean
  latest7: number | null
}): SuggestionTone {
  if (hasReviews && latest7 !== null && latest7 < RETENTION_WARNING_THRESHOLD) {
    return 'warning'
  }

  if (latest7 !== null && latest7 >= RETENTION_STRONG_THRESHOLD) {
    return 'success'
  }

  return 'default'
}

export function getTrendsTone({
  weakestCardType,
  cardTypeSpread,
}: {
  weakestCardType: CardTypePerformance | undefined
  cardTypeSpread: number | null
}): SuggestionTone {
  if (
    weakestCardType &&
    weakestCardType.rate !== null &&
    weakestCardType.rate < TRENDS_WARNING_RATE_THRESHOLD
  ) {
    return 'warning'
  }

  if (
    cardTypeSpread !== null &&
    cardTypeSpread <= TRENDS_BALANCED_SPREAD_THRESHOLD
  ) {
    return 'success'
  }

  return 'default'
}

export function getIntervalTone({
  weakestIntervalBucket,
  intervalSpread,
}: {
  weakestIntervalBucket: IntervalPerformanceBucket | undefined
  intervalSpread: number | null
}): SuggestionTone {
  if (
    weakestIntervalBucket &&
    weakestIntervalBucket.rate !== null &&
    weakestIntervalBucket.rate < INTERVAL_WARNING_THRESHOLD &&
    weakestIntervalBucket.label !== INTERVAL_EARLY_BUCKET_LABEL
  ) {
    return 'warning'
  }

  if (
    intervalSpread !== null &&
    intervalSpread <= INTERVAL_SPREAD_SUCCESS_THRESHOLD
  ) {
    return 'success'
  }

  return 'default'
}

export function getWorkloadTone({
  hourlySpread,
  hasHourlyPerformance,
}: {
  hourlySpread: number | null
  hasHourlyPerformance: boolean
}): SuggestionTone {
  if (hourlySpread !== null && hourlySpread >= WORKLOAD_TONE_SPREAD_THRESHOLD) {
    return 'warning'
  }

  if (hasHourlyPerformance) {
    return 'success'
  }

  return 'default'
}

export function getForecastTone({
  forecastSpikeRatio,
  first7Share,
}: {
  forecastSpikeRatio: number
  first7Share: number
}): SuggestionTone {
  if (
    forecastSpikeRatio >= FORECAST_ACTION_SPIKE_RATIO_THRESHOLD ||
    first7Share >= FORECAST_FIRST_WEEK_SHARE_WARNING_THRESHOLD
  ) {
    return 'warning'
  }

  return 'default'
}
