import * as Sentry from '@sentry/tanstackstart-react'
import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { LeechesPage } from '../components/leeches/LeechesPage'

export const Route = createFileRoute('/study-leeches')({
  loader: async ({ context }) => {
    await Sentry.startSpan(
      { name: 'study-leeches.prefetch', op: 'navigation' },
      async () => {
        await Promise.all([
          context.queryClient.ensureQueryData(
            convexQuery(api.cardStates.listLeechCards, {}),
          ),
          context.queryClient.ensureQueryData(
            convexQuery(api.cardStates.getLeechStats, {}),
          ),
        ])
      },
    )
  },
  component: LeechesPage,
})
