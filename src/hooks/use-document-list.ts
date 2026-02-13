import { useInfiniteQuery } from '@tanstack/react-query'
import { useConvex, useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

export type DocumentPage = {
  page: Array<Doc<'documents'>>
  continueCursor: string | null
  isDone: boolean
}

interface UseDocumentListOptions {
  /** Number of documents to fetch per page. Defaults to 20. */
  numItems?: number
  /** Whether the query should run. Defaults to true. */
  enabled?: boolean
}

export function useDocumentList(options: UseDocumentListOptions = {}) {
  const { numItems = 20, enabled = true } = options
  const { isAuthenticated } = useConvexAuth()
  const convex = useConvex()

  return useInfiniteQuery({
    queryKey: ['documents', 'list', numItems],
    queryFn: async ({ pageParam }) => {
      return await convex.query(api.documents.list, {
        paginationOpts: {
          numItems,
          cursor: pageParam,
        },
      })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: DocumentPage) =>
      lastPage.isDone ? null : lastPage.continueCursor,
    enabled: isAuthenticated && enabled,
  })
}
