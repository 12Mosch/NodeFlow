import { convexQuery } from '@convex-dev/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import { LeechesPage } from '../components/leeches/LeechesPage'

export const Route = createFileRoute('/study-leeches')({
  loader: async ({ context }) => {
    await (async () => {
      await Promise.all([
        context.queryClient.ensureQueryData(
          convexQuery(api.cardStates.listLeechCards, {}),
        ),
        context.queryClient.ensureQueryData(
          convexQuery(api.cardStates.getLeechStats, {}),
        ),
      ])
    })()
  },
  component: LeechesPage,
})
