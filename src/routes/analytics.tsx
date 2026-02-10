import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

export const Route = createFileRoute('/analytics')({
  loader: async ({ context }) => {
    await (async () => {
      await context.queryClient.ensureQueryData(
        convexQuery(api.cardStates.getAnalyticsDashboard, {}),
      )
    })()
  },
  component: AnalyticsDashboard,
})
