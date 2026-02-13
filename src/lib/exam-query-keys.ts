import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// Convex query keys are [functionReference, args, ...].
// Slicing to the first two entries lets us invalidate all argument variants.
export const LIST_DOCUMENT_INDICATORS_QUERY_PREFIX = convexQuery(
  api.exams.listDocumentIndicators,
  { documentIds: [] as Array<Id<'documents'>> },
).queryKey.slice(0, 2)

const ANY_DOCUMENT_ID = '__any-document-id__' as Id<'documents'>

// We use a placeholder document id only to generate a stable key prefix.
export const DOCUMENT_HEADER_INDICATOR_QUERY_PREFIX = convexQuery(
  api.exams.getDocumentHeaderIndicator,
  { documentId: ANY_DOCUMENT_ID },
).queryKey.slice(0, 2)
