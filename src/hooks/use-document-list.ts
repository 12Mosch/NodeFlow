import { useInfiniteQuery } from '@tanstack/react-query'
import { useConvex, useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

type DocumentPage = {
  page: Array<Doc<'documents'>>
  continueCursor: string
  isDone: boolean
}

interface UseDocumentListOptions {
  /** Number of documents to fetch per page. Defaults to 20. */
  numItems?: number
}

export function useDocumentList(options: UseDocumentListOptions = {}) {
  const { numItems = 20 } = options
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
    enabled: isAuthenticated,
  })
}
