import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useMemo } from 'react'
import { convexQueryClient } from '../convex/provider'
import { createIDBPersister } from './persister'

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: TWENTY_FOUR_HOURS,
      },
    },
  })
  try {
    convexQueryClient.connect(queryClient)
  } catch (error) {
    // If already connected, that's fine - hashFn and queryFn work without active connection
    if (error instanceof Error && error.message === 'already subscribed!') {
      // Already connected, which is fine - continue without error
    } else {
      throw error
    }
  }

  return {
    queryClient,
  }
}

export function Provider({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  // Create persister only on client-side, memoized to avoid recreation
  const persister = useMemo(() => {
    if (typeof window === 'undefined') return null
    return createIDBPersister()
  }, [])

  // Use PersistQueryClientProvider on client-side for IndexedDB caching
  if (persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: TWENTY_FOUR_HOURS,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              // Only persist successful queries
              return query.state.status === 'success'
            },
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    )
  }

  // Server-side rendering uses regular QueryClientProvider
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
