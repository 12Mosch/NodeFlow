import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { DocumentPage } from '@/hooks/use-document-list'
import type { DocumentExamIndicatorWithId } from '@/lib/exams'
import { mergeDocumentExamIndicatorPages } from '@/lib/exams'

function combineIndicatorQueryResults(
  results: Array<{ data: Array<DocumentExamIndicatorWithId> | undefined }>,
) {
  return mergeDocumentExamIndicatorPages(
    results.map((query) => query.data ?? []),
  )
}

export function useDocumentExamIndicators(
  pages: Array<DocumentPage> | undefined,
) {
  const pageDocumentIds = useMemo(
    () =>
      (pages ?? [])
        .map((page) =>
          Array.from(new Set(page.page.map((document) => document._id))),
        )
        .filter((documentIds) => documentIds.length > 0),
    [pages],
  )

  const documentExamIndicatorById = useQueries({
    queries: pageDocumentIds.map((documentIds) =>
      convexQuery(api.exams.listDocumentIndicators, { documentIds }),
    ),
    combine: combineIndicatorQueryResults,
  })

  return { documentExamIndicatorById }
}
