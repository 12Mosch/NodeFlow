import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { ExamBadge } from './exam-badge'
import type { Id } from '../../../convex/_generated/dataModel'

interface DocumentExamBadgeProps {
  documentId: Id<'documents'>
}

export function DocumentExamBadge({ documentId }: DocumentExamBadgeProps) {
  const { data: exams } = useQuery(
    convexQuery(api.exams.getForDocument, { documentId }),
  )

  if (!exams || exams.length === 0) {
    return null
  }

  return <ExamBadge exams={exams} compact />
}
