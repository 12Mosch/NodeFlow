import * as Sentry from '@sentry/tanstackstart-react'
import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

export const Route = createFileRoute('/analytics')({
  loader: async ({ context }) => {
    await Sentry.startSpan(
      { name: 'analytics.prefetch', op: 'navigation' },
      async () => {
        await context.queryClient.ensureQueryData(
          convexQuery(api.cardStates.getAnalyticsDashboard, {}),
        )
      },
    )
  },
  component: AnalyticsDashboard,
})
