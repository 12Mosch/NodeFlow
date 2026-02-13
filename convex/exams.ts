import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireUser } from './auth'
import { requireDocumentAccess } from './helpers/documentAccess'
import { buildDocumentActiveExamSummaryByDocumentId } from './helpers/examDocuments'
import type { DocumentExamIndicator } from '../shared/exam-indicators'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

function normalizeTitle(title: string) {
  const normalized = title.trim()
  if (!normalized) {
    throw new Error('Exam title is required')
  }
  return normalized
}

function normalizeNotes(notes: string | undefined) {
  if (notes === undefined) return undefined
  const normalized = notes.trim()
  return normalized.length > 0 ? normalized : undefined
}

function dedupeDocumentIds(documentIds: Array<Id<'documents'>>) {
  return Array.from(new Set(documentIds))
}

async function requireOwnedExam(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  examId: Id<'exams'>,
) {
  const exam = await ctx.db.get(examId)
  if (!exam || exam.userId !== userId) {
    throw new Error('Exam not found or access denied')
  }
  return exam
}

async function assertOwnedDocuments(
  ctx: MutationCtx,
  userId: Id<'users'>,
  documentIds: Array<Id<'documents'>>,
) {
  const documents = await Promise.all(documentIds.map((id) => ctx.db.get(id)))
  for (const document of documents) {
    if (!document || document.userId !== userId) {
      throw new Error('Document not found or access denied')
    }
  }
}

async function buildDocumentIndicatorMap(
  ctx: QueryCtx,
  userId: Id<'users'>,
  documentIds: Array<Id<'documents'>>,
  now: number,
) {
  const summaryByDocumentId = await buildDocumentActiveExamSummaryByDocumentId(
    ctx,
    userId,
    documentIds,
    now,
  )
  const indicatorByDocumentId = new Map<
    Id<'documents'>,
    DocumentExamIndicator
  >()
  for (const [documentId, summary] of summaryByDocumentId) {
    indicatorByDocumentId.set(documentId, {
      activeExamCount: summary.activeExamCount,
      nextExamAt: summary.nextExam?.examAt ?? null,
      nextExamTitle: summary.nextExam?.title ?? null,
    })
  }
  return indicatorByDocumentId
}

export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    includePast: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    const includeArchived = args.includeArchived ?? false
    const includePast = args.includePast ?? false
    const filtered = includeArchived
      ? includePast
        ? await ctx.db
            .query('exams')
            .withIndex('by_user_examAt', (q) => q.eq('userId', userId))
            .collect()
        : await ctx.db
            .query('exams')
            .withIndex('by_user_examAt', (q) =>
              q.eq('userId', userId).gt('examAt', now),
            )
            .collect()
      : includePast
        ? await ctx.db
            .query('exams')
            .withIndex('by_user_archived_examAt', (q) =>
              q.eq('userId', userId).eq('archivedAt', undefined),
            )
            .collect()
        : await ctx.db
            .query('exams')
            .withIndex('by_user_archived_examAt', (q) =>
              q
                .eq('userId', userId)
                .eq('archivedAt', undefined)
                .gt('examAt', now),
            )
            .collect()
    if (filtered.length === 0) {
      return []
    }
    const linksByExamId = new Map<Id<'exams'>, Array<Doc<'examDocuments'>>>()
    await Promise.all(
      filtered.map(async (exam) => {
        const links = await ctx.db
          .query('examDocuments')
          .withIndex('by_user_exam', (q) =>
            q.eq('userId', userId).eq('examId', exam._id),
          )
          .collect()
        linksByExamId.set(exam._id, links)
      }),
    )
    return filtered.map((exam) => {
      const links = linksByExamId.get(exam._id) ?? []
      return {
        ...exam,
        documentIds: links.map((link) => link.documentId),
        linkedDocumentCount: links.length,
      }
    })
  },
})

export const get = query({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const exam = await requireOwnedExam(ctx, userId, args.examId)
    const links = await ctx.db
      .query('examDocuments')
      .withIndex('by_user_exam', (q) =>
        q.eq('userId', userId).eq('examId', args.examId),
      )
      .collect()
    return {
      ...exam,
      documentIds: links.map((link) => link.documentId),
      linkedDocumentCount: links.length,
    }
  },
})

export const listDocumentIndicators = query({
  args: {
    documentIds: v.array(v.id('documents')),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    const dedupedDocumentIds = dedupeDocumentIds(args.documentIds)
    if (dedupedDocumentIds.length === 0) return []
    const indicatorByDocumentId = await buildDocumentIndicatorMap(
      ctx,
      userId,
      dedupedDocumentIds,
      now,
    )
    return dedupedDocumentIds.map((documentId) => ({
      documentId,
      ...(indicatorByDocumentId.get(documentId) ?? {
        activeExamCount: 0,
        nextExamAt: null,
        nextExamTitle: null,
      }),
    }))
  },
})

export const getDocumentHeaderIndicator = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireDocumentAccess(ctx, args.documentId)
    const now = Date.now()
    const indicatorByDocumentId = await buildDocumentIndicatorMap(
      ctx,
      userId,
      [args.documentId],
      now,
    )
    return (
      indicatorByDocumentId.get(args.documentId) ?? {
        activeExamCount: 0,
        nextExamAt: null,
        nextExamTitle: null,
      }
    )
  },
})

export const getStudyOverviewTotals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    const activeExams = await ctx.db
      .query('exams')
      .withIndex('by_user_archived_examAt', (q) =>
        q.eq('userId', userId).eq('archivedAt', undefined).gt('examAt', now),
      )
      .collect()
    const nextExam = activeExams.at(0)
    return {
      activeExamCount: activeExams.length,
      nextExamAt: nextExam?.examAt ?? null,
      nextExamTitle: nextExam?.title ?? null,
    }
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    examAt: v.number(),
    notes: v.optional(v.string()),
    documentIds: v.array(v.id('documents')),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    if (args.examAt <= now) {
      throw new Error('Exam date must be in the future')
    }
    const documentIds = dedupeDocumentIds(args.documentIds)
    await assertOwnedDocuments(ctx, userId, documentIds)
    const examId = await ctx.db.insert('exams', {
      userId,
      title: normalizeTitle(args.title),
      examAt: args.examAt,
      notes: normalizeNotes(args.notes),
      createdAt: now,
      updatedAt: now,
    })
    for (const documentId of documentIds) {
      await ctx.db.insert('examDocuments', {
        userId,
        examId,
        documentId,
        createdAt: now,
      })
    }
    return examId
  },
})

export const update = mutation({
  args: {
    examId: v.id('exams'),
    title: v.optional(v.string()),
    examAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    documentIds: v.optional(v.array(v.id('documents'))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await requireOwnedExam(ctx, userId, args.examId)
    const now = Date.now()
    const patch: {
      title?: string
      examAt?: number
      notes?: string
      updatedAt: number
    } = {
      updatedAt: now,
    }
    if (args.title !== undefined) {
      patch.title = normalizeTitle(args.title)
    }
    if (args.examAt !== undefined) {
      if (args.examAt <= now) {
        throw new Error('Exam date must be in the future')
      }
      patch.examAt = args.examAt
    }
    if (args.notes !== undefined) {
      patch.notes = normalizeNotes(args.notes) ?? ''
    }
    if (args.documentIds !== undefined) {
      const documentIds = dedupeDocumentIds(args.documentIds)
      await assertOwnedDocuments(ctx, userId, documentIds)
      const links = await ctx.db
        .query('examDocuments')
        .withIndex('by_user_exam', (q) =>
          q.eq('userId', userId).eq('examId', args.examId),
        )
        .collect()
      const nextDocumentIdSet = new Set(documentIds)
      const existingDocumentIdSet = new Set(
        links.map((link) => link.documentId),
      )
      for (const link of links) {
        if (!nextDocumentIdSet.has(link.documentId)) {
          await ctx.db.delete(link._id)
        }
      }
      for (const documentId of documentIds) {
        if (!existingDocumentIdSet.has(documentId)) {
          await ctx.db.insert('examDocuments', {
            userId,
            examId: args.examId,
            documentId,
            createdAt: now,
          })
        }
      }
    }
    await ctx.db.patch(args.examId, patch)
    return args.examId
  },
})

export const archive = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await requireOwnedExam(ctx, userId, args.examId)
    const now = Date.now()
    await ctx.db.patch(args.examId, {
      archivedAt: now,
      updatedAt: now,
    })
  },
})

export const unarchive = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await requireOwnedExam(ctx, userId, args.examId)
    await ctx.db.patch(args.examId, {
      archivedAt: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    await requireOwnedExam(ctx, userId, args.examId)
    const links = await ctx.db
      .query('examDocuments')
      .withIndex('by_user_exam', (q) =>
        q.eq('userId', userId).eq('examId', args.examId),
      )
      .collect()
    for (const link of links) {
      await ctx.db.delete(link._id)
    }
    await ctx.db.delete(args.examId)
  },
})
