import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { convexQueryClient } from '../convex/provider'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
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
      throw error;
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
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
