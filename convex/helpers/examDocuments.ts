import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export type NextActiveExam = {
  examId: Id<'exams'>
  title: string
  examAt: number
}

export type DocumentActiveExamSummary = {
  activeExamCount: number
  nextExam: NextActiveExam | null
}

export async function buildDocumentActiveExamSummaryByDocumentId(
  ctx: QueryCtx,
  userId: Id<'users'>,
  documentIds: Array<Id<'documents'>>,
  now: number,
) {
  const dedupedDocumentIds = Array.from(new Set(documentIds))
  const summaryByDocumentId = new Map<
    Id<'documents'>,
    DocumentActiveExamSummary
  >(
    dedupedDocumentIds.map((documentId) => [
      documentId,
      { activeExamCount: 0, nextExam: null },
    ]),
  )
  if (dedupedDocumentIds.length === 0) {
    return summaryByDocumentId
  }

  const linksByDocument = await Promise.all(
    dedupedDocumentIds.map((documentId) =>
      ctx.db
        .query('examDocuments')
        .withIndex('by_user_document', (q) =>
          q.eq('userId', userId).eq('documentId', documentId),
        )
        .collect(),
    ),
  )

  const uniqueExamIds = Array.from(
    new Set(
      linksByDocument.flatMap((links) => links.map((link) => link.examId)),
    ),
  )
  if (uniqueExamIds.length === 0) {
    return summaryByDocumentId
  }

  const exams = await Promise.all(
    uniqueExamIds.map((examId) => ctx.db.get(examId)),
  )
  const activeExamById = new Map(
    exams
      .filter(
        (exam): exam is NonNullable<typeof exam> =>
          exam !== null &&
          exam.userId === userId &&
          exam.archivedAt === undefined &&
          exam.examAt > now,
      )
      .map((exam) => [exam._id, exam]),
  )

  for (const [index, documentId] of dedupedDocumentIds.entries()) {
    const activeExams = Array.from(
      new Set(linksByDocument[index].map((link) => link.examId)),
    )
      .map((examId) => activeExamById.get(examId))
      .filter((exam): exam is NonNullable<typeof exam> => exam !== undefined)
      .sort((a, b) => a.examAt - b.examAt)

    const nextExam = activeExams.at(0)
    summaryByDocumentId.set(documentId, {
      activeExamCount: activeExams.length,
      nextExam: nextExam
        ? {
            examId: nextExam._id,
            title: nextExam.title,
            examAt: nextExam.examAt,
          }
        : null,
    })
  }

  return summaryByDocumentId
}
