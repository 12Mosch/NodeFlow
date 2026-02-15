import { useCallback, useState } from 'react'
import { isDifficultyBucketLabel } from '../../../../shared/analytics-buckets'
import type { DifficultyBucketLabel } from '../../../../shared/analytics-buckets'
import type { RetentionSeriesKey } from './types'
import type { Dispatch, SetStateAction } from 'react'

export function toDifficultyBucketLabel(
  label: string,
): DifficultyBucketLabel | null {
  return isDifficultyBucketLabel(label) ? label : null
}

function toggleSelection<T extends string>(current: T | null, next: T) {
  return current === next ? null : next
}

export function toggleRetentionSeries(
  current: RetentionSeriesKey | null,
  next: RetentionSeriesKey,
) {
  return toggleSelection(current, next)
}

export function toggleDifficultyBucket(
  current: DifficultyBucketLabel | null,
  next: DifficultyBucketLabel,
) {
  return toggleSelection(current, next)
}

export interface AnalyticsDashboardInteractions {
  selectedDifficultyBucket: DifficultyBucketLabel | null
  hoveredDifficultyBucket: DifficultyBucketLabel | null
  selectedRetentionSeries: RetentionSeriesKey | null
  hoveredRetentionSeries: RetentionSeriesKey | null
  highlightedRetentionSeries: RetentionSeriesKey | null
  setHoveredDifficultyBucket: Dispatch<
    SetStateAction<DifficultyBucketLabel | null>
  >
  setHoveredRetentionSeries: Dispatch<SetStateAction<RetentionSeriesKey | null>>
  clearSelectedDifficultyBucket: () => void
  toggleSelectedDifficultyBucket: (label: DifficultyBucketLabel) => void
  toggleSelectedRetentionSeries: (key: RetentionSeriesKey) => void
}

export function useAnalyticsInteractions(): AnalyticsDashboardInteractions {
  const [selectedDifficultyBucket, setSelectedDifficultyBucket] =
    useState<DifficultyBucketLabel | null>(null)
  const [hoveredDifficultyBucket, setHoveredDifficultyBucket] =
    useState<DifficultyBucketLabel | null>(null)
  const [selectedRetentionSeries, setSelectedRetentionSeries] =
    useState<RetentionSeriesKey | null>(null)
  const [hoveredRetentionSeries, setHoveredRetentionSeries] =
    useState<RetentionSeriesKey | null>(null)
  const clearSelectedDifficultyBucket = useCallback(() => {
    setSelectedDifficultyBucket(null)
  }, [])
  const toggleSelectedDifficultyBucket = useCallback(
    (label: DifficultyBucketLabel) => {
      setSelectedDifficultyBucket((current) =>
        toggleDifficultyBucket(current, label),
      )
    },
    [],
  )
  const toggleSelectedRetentionSeries = useCallback(
    (key: RetentionSeriesKey) => {
      setSelectedRetentionSeries((current) =>
        toggleRetentionSeries(current, key),
      )
    },
    [],
  )

  return {
    selectedDifficultyBucket,
    hoveredDifficultyBucket,
    selectedRetentionSeries,
    hoveredRetentionSeries,
    highlightedRetentionSeries:
      hoveredRetentionSeries ?? selectedRetentionSeries,
    setHoveredDifficultyBucket,
    setHoveredRetentionSeries,
    clearSelectedDifficultyBucket,
    toggleSelectedDifficultyBucket,
    toggleSelectedRetentionSeries,
  }
}
