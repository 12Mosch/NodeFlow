import { useCallback, useEffect, useMemo, useState } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { api } from '../../../convex/_generated/api'
import { AnalyticsDashboardPresentation } from './dashboard/AnalyticsDashboardPresentation'
import { useAnalyticsInteractions } from './dashboard/useAnalyticsInteractions'
import { useDerivedAnalytics } from './dashboard/useDerivedAnalytics'
import type { RetentionSeries } from './dashboard/types'

export function AnalyticsDashboard() {
  const router = useRouter()
  const { data } = useSuspenseQuery(
    convexQuery(api.cardStates.getAnalyticsDashboard, {}),
  )
  const interactions = useAnalyticsInteractions()
  const { selectedDifficultyBucket } = interactions

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

  const retentionSeries = useMemo<RetentionSeries>(
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

  const handleBack = useCallback(() => {
    let canGoBack = false

    if ('canGoBack' in router && typeof router.canGoBack === 'function') {
      canGoBack = router.canGoBack()
    } else if (
      'canGoBack' in router.history &&
      typeof router.history.canGoBack === 'function'
    ) {
      canGoBack = router.history.canGoBack()
    }

    if (canGoBack) {
      router.history.back()
      return
    }

    void router.navigate({ to: '/' })
  }, [router])

  if (!data) return null
  if (!derived) return null

  return (
    <AnalyticsDashboardPresentation
      data={data}
      derived={derived}
      retentionSeries={retentionSeries}
      offsetMinutes={offsetMinutes}
      interactions={interactions}
      difficultyBucketCards={difficultyBucketCards}
      isDifficultyCardsPending={isDifficultyCardsPending}
      onBack={handleBack}
    />
  )
}
