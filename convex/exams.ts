import * as Sentry from '@sentry/tanstackstart-react'
import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { requireUser } from './auth'
import {
  calculateRetrievabilityPeriodDays,
  countCardsFromBlocks,
  getDaysUntilExam,
  isInRetrievabilityPeriod,
} from './helpers/examScheduling'
import type { Doc } from './_generated/dataModel'

/**
 * Create a new exam
 */
export const create = mutation({
  args: {
    title: v.string(),
    examDate: v.number(),
    color: v.optional(v.string()),
    documentIds: v.optional(v.array(v.id('documents'))),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.create', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        // Validate exam date is in the future
        if (args.examDate <= now) {
          throw new Error('Exam date must be in the future')
        }

        // Create the exam
        const examId = await ctx.db.insert('exams', {
          userId,
          title: args.title,
          examDate: args.examDate,
          color: args.color,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        })

        // Add documents if provided
        if (args.documentIds && args.documentIds.length > 0) {
          for (const documentId of args.documentIds) {
            // Verify document ownership
            const doc = await ctx.db.get(documentId)
            if (doc && doc.userId === userId) {
              await ctx.db.insert('examDocuments', {
                examId,
                documentId,
                userId,
                createdAt: now,
              })
            }
          }
        }

        return examId
      },
    )
  },
})

/**
 * Update an existing exam
 */
export const update = mutation({
  args: {
    examId: v.id('exams'),
    title: v.optional(v.string()),
    examDate: v.optional(v.number()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.update', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        const now = Date.now()

        // Validate exam date is in the future if being updated
        if (args.examDate !== undefined && args.examDate <= now) {
          throw new Error('Exam date must be in the future')
        }

        const updates: Partial<Doc<'exams'>> = {
          updatedAt: now,
        }

        if (args.title !== undefined) {
          updates.title = args.title
        }
        if (args.examDate !== undefined) {
          updates.examDate = args.examDate
        }
        if (args.color !== undefined) {
          updates.color = args.color
        }

        await ctx.db.patch(args.examId, updates)
      },
    )
  },
})

/**
 * Archive an exam (soft delete)
 */
export const archive = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.archive', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        await ctx.db.patch(args.examId, {
          isArchived: true,
          updatedAt: Date.now(),
        })
      },
    )
  },
})

// Batch size for paginated archiving
const ARCHIVE_BATCH_SIZE = 100

/**
 * Archive past exams automatically.
 * Called by cron job. Uses batching to handle large numbers of exams.
 */
export const archivePastExams = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let totalArchived = 0
    let hasMore = true

    while (hasMore) {
      // Query non-archived exams where examDate < now
      // No userId filter - process all users' exams
      const pastExams = await ctx.db
        .query('exams')
        .filter((q) =>
          q.and(
            q.eq(q.field('isArchived'), false),
            q.lt(q.field('examDate'), now),
          ),
        )
        .take(ARCHIVE_BATCH_SIZE)

      if (pastExams.length === 0) {
        hasMore = false
        break
      }

      // Archive all past exams in batch
      await Promise.all(
        pastExams.map((exam) =>
          ctx.db.patch(exam._id, {
            isArchived: true,
            updatedAt: now,
          }),
        ),
      )

      totalArchived += pastExams.length

      if (pastExams.length < ARCHIVE_BATCH_SIZE) {
        hasMore = false
      }
    }

    return { archived: totalArchived }
  },
})

/**
 * Unarchive an exam
 */
export const unarchive = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.unarchive', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        await ctx.db.patch(args.examId, {
          isArchived: false,
          updatedAt: Date.now(),
        })
      },
    )
  },
})

/**
 * Permanently delete an exam and its document links
 */
export const deleteExam = mutation({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.deleteExam', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        // Delete all examDocument links
        const examDocs = await ctx.db
          .query('examDocuments')
          .withIndex('by_exam', (q) => q.eq('examId', args.examId))
          .collect()

        for (const examDoc of examDocs) {
          await ctx.db.delete(examDoc._id)
        }

        // Delete the exam
        await ctx.db.delete(args.examId)
      },
    )
  },
})

/**
 * Add documents to an exam
 */
export const addDocuments = mutation({
  args: {
    examId: v.id('exams'),
    documentIds: v.array(v.id('documents')),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.addDocuments', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        // Get existing document links to avoid duplicates
        const existingLinks = await ctx.db
          .query('examDocuments')
          .withIndex('by_exam', (q) => q.eq('examId', args.examId))
          .collect()

        const existingDocIds = new Set(existingLinks.map((l) => l.documentId))

        for (const documentId of args.documentIds) {
          if (existingDocIds.has(documentId)) {
            continue // Skip duplicates
          }

          // Verify document ownership
          const doc = await ctx.db.get(documentId)
          if (doc && doc.userId === userId) {
            await ctx.db.insert('examDocuments', {
              examId: args.examId,
              documentId,
              userId,
              createdAt: now,
            })
          }
        }

        // Update exam timestamp
        await ctx.db.patch(args.examId, { updatedAt: now })
      },
    )
  },
})

/**
 * Remove a document from an exam
 */
export const removeDocument = mutation({
  args: {
    examId: v.id('exams'),
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.removeDocument', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        // Find and delete the link
        const links = await ctx.db
          .query('examDocuments')
          .withIndex('by_exam', (q) => q.eq('examId', args.examId))
          .collect()

        const link = links.find((l) => l.documentId === args.documentId)
        if (link) {
          await ctx.db.delete(link._id)
        }

        // Update exam timestamp
        await ctx.db.patch(args.examId, { updatedAt: Date.now() })
      },
    )
  },
})

/**
 * Set the documents for an exam atomically (replaces all existing document links)
 */
export const setDocuments = mutation({
  args: {
    examId: v.id('exams'),
    documentIds: v.array(v.id('documents')),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.setDocuments', op: 'convex.mutation' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          throw new Error('Exam not found or access denied')
        }

        // Get existing document links
        const existingLinks = await ctx.db
          .query('examDocuments')
          .withIndex('by_exam', (q) => q.eq('examId', args.examId))
          .collect()

        const existingDocIds = new Set(existingLinks.map((l) => l.documentId))
        const newDocIds = new Set(args.documentIds)

        // Remove documents that are no longer in the list
        for (const link of existingLinks) {
          if (!newDocIds.has(link.documentId)) {
            await ctx.db.delete(link._id)
          }
        }

        // Add new documents
        for (const documentId of args.documentIds) {
          if (existingDocIds.has(documentId)) {
            continue // Already linked
          }

          // Verify document ownership
          const doc = await ctx.db.get(documentId)
          if (doc && doc.userId === userId) {
            await ctx.db.insert('examDocuments', {
              examId: args.examId,
              documentId,
              userId,
              createdAt: now,
            })
          }
        }

        // Update exam timestamp
        await ctx.db.patch(args.examId, { updatedAt: now })
      },
    )
  },
})

/**
 * List user's exams with optional archive filter
 */
export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.list', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        let exams: Array<Doc<'exams'>>

        if (args.includeArchived) {
          exams = await ctx.db
            .query('exams')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .collect()
        } else {
          exams = await ctx.db
            .query('exams')
            .withIndex('by_user_archived', (q) =>
              q.eq('userId', userId).eq('isArchived', false),
            )
            .collect()
        }

        // Fetch document counts and card counts for each exam
        const examsWithStats = await Promise.all(
          exams.map(async (exam) => {
            const examDocs = await ctx.db
              .query('examDocuments')
              .withIndex('by_exam', (q) => q.eq('examId', exam._id))
              .collect()

            const documentIds = examDocs.map((ed) => ed.documentId)

            // Count total cards across all linked documents
            let totalCards = 0
            for (const docId of documentIds) {
              const cards = await ctx.db
                .query('blocks')
                .withIndex('by_document_isCard', (q) =>
                  q.eq('documentId', docId).eq('isCard', true),
                )
                .collect()
              totalCards += countCardsFromBlocks(cards)
            }

            const daysUntil = getDaysUntilExam(exam.examDate, now)
            const inRetrievabilityPeriod = isInRetrievabilityPeriod(
              exam.examDate,
              totalCards,
              now,
            )
            const retrievabilityPeriodDays =
              calculateRetrievabilityPeriodDays(totalCards)

            return {
              ...exam,
              documentCount: documentIds.length,
              cardCount: totalCards,
              daysUntil,
              inRetrievabilityPeriod,
              retrievabilityPeriodDays,
              isPast: exam.examDate < now,
            }
          }),
        )

        // Sort by exam date (nearest first)
        return examsWithStats.sort((a, b) => a.examDate - b.examDate)
      },
    )
  },
})

/**
 * Get a single exam with its documents and stats
 */
export const get = query({
  args: {
    examId: v.id('exams'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.get', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        const exam = await ctx.db.get(args.examId)
        if (!exam || exam.userId !== userId) {
          return null
        }

        // Get linked documents
        const examDocs = await ctx.db
          .query('examDocuments')
          .withIndex('by_exam', (q) => q.eq('examId', args.examId))
          .collect()

        const documents = await Promise.all(
          examDocs.map(async (ed) => {
            const doc = await ctx.db.get(ed.documentId)
            if (!doc) return null

            // Count cards in this document
            const cards = await ctx.db
              .query('blocks')
              .withIndex('by_document_isCard', (q) =>
                q.eq('documentId', ed.documentId).eq('isCard', true),
              )
              .collect()

            let cardCount = 0
            for (const card of cards) {
              if (card.cardDirection === 'bidirectional') {
                cardCount += 2
              } else if (card.cardDirection !== 'disabled') {
                cardCount += 1
              }
            }

            return {
              _id: doc._id,
              title: doc.title,
              cardCount,
            }
          }),
        )

        const validDocuments = documents.filter(
          (d): d is NonNullable<typeof d> => d !== null,
        )
        const totalCards = validDocuments.reduce(
          (sum, d) => sum + d.cardCount,
          0,
        )

        const daysUntil = getDaysUntilExam(exam.examDate, now)
        const inRetrievabilityPeriod = isInRetrievabilityPeriod(
          exam.examDate,
          totalCards,
          now,
        )
        const retrievabilityPeriodDays =
          calculateRetrievabilityPeriodDays(totalCards)

        return {
          ...exam,
          documents: validDocuments,
          cardCount: totalCards,
          daysUntil,
          inRetrievabilityPeriod,
          retrievabilityPeriodDays,
          isPast: exam.examDate < now,
        }
      },
    )
  },
})

/**
 * Get exams linked to a specific document
 */
export const getForDocument = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    return await Sentry.startSpan(
      { name: 'exams.getForDocument', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        // Get all exam links for this document
        const examLinks = await ctx.db
          .query('examDocuments')
          .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
          .collect()

        // Fetch the exams
        const exams = await Promise.all(
          examLinks.map(async (link) => {
            const exam = await ctx.db.get(link.examId)
            if (!exam || exam.userId !== userId || exam.isArchived) {
              return null
            }

            const daysUntil = getDaysUntilExam(exam.examDate, now)

            return {
              _id: exam._id,
              title: exam.title,
              examDate: exam.examDate,
              color: exam.color,
              daysUntil,
              isPast: exam.examDate < now,
            }
          }),
        )

        return exams
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => a.examDate - b.examDate)
      },
    )
  },
})

/**
 * Get active exams that are currently in their retrievability period
 * Used for prioritizing cards in the study queue
 */
export const getActiveInRetrievabilityPeriod = query({
  args: {},
  handler: async (ctx) => {
    return await Sentry.startSpan(
      { name: 'exams.getActiveInRetrievabilityPeriod', op: 'convex.query' },
      async () => {
        const userId = await requireUser(ctx)
        const now = Date.now()

        // Get all non-archived exams
        const exams = await ctx.db
          .query('exams')
          .withIndex('by_user_archived', (q) =>
            q.eq('userId', userId).eq('isArchived', false),
          )
          .collect()

        // Filter to future exams only
        const futureExams = exams.filter((e) => e.examDate > now)

        // For each exam, get card count and check if in retrievability period
        const activeExams = await Promise.all(
          futureExams.map(async (exam) => {
            const examDocs = await ctx.db
              .query('examDocuments')
              .withIndex('by_exam', (q) => q.eq('examId', exam._id))
              .collect()

            const documentIds = examDocs.map((ed) => ed.documentId)

            // Count total cards
            let totalCards = 0
            for (const docId of documentIds) {
              const cards = await ctx.db
                .query('blocks')
                .withIndex('by_document_isCard', (q) =>
                  q.eq('documentId', docId).eq('isCard', true),
                )
                .collect()

              for (const card of cards) {
                if (card.cardDirection === 'bidirectional') {
                  totalCards += 2
                } else if (card.cardDirection !== 'disabled') {
                  totalCards += 1
                }
              }
            }

            const inPeriod = isInRetrievabilityPeriod(
              exam.examDate,
              totalCards,
              now,
            )

            if (!inPeriod) {
              return null
            }

            return {
              exam,
              documentIds,
              cardCount: totalCards,
              daysUntil: getDaysUntilExam(exam.examDate, now),
            }
          }),
        )

        return activeExams
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => a.daysUntil - b.daysUntil)
      },
    )
  },
})
