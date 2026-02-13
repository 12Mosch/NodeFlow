/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')
// Keep this local in convex tests to avoid importing across app/server boundaries.
const DAY_MS = 24 * 60 * 60 * 1000

async function createAuthenticatedContext(t: ReturnType<typeof convexTest>) {
  const workosId = `test-workos-${Date.now()}-${Math.random()}`
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      workosId,
      email: `${workosId}@example.com`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })
  return {
    userId,
    asUser: t.withIdentity({ subject: workosId }),
  }
}

async function createTestDocument(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  title: string = 'Test Document',
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('documents', {
      userId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })
}

describe('exams', () => {
  let t: ReturnType<typeof convexTest>
  let userId: Id<'users'>
  let asUser: ReturnType<ReturnType<typeof convexTest>['withIdentity']>
  let docId: Id<'documents'>

  beforeEach(async () => {
    t = convexTest(schema, modules)
    const context = await createAuthenticatedContext(t)
    userId = context.userId
    asUser = context.asUser
    docId = await createTestDocument(t, userId)
  })

  it('rejects linking non-owned documents on create', async () => {
    const { userId: otherUserId } = await createAuthenticatedContext(t)
    const otherDocId = await createTestDocument(
      t,
      otherUserId,
      'Other User Doc',
    )

    await expect(
      asUser.mutation(api.exams.create, {
        title: 'Biology Midterm',
        examAt: Date.now() + 24 * 60 * 60 * 1000,
        documentIds: [otherDocId],
      }),
    ).rejects.toThrow('Document not found or access denied')
  })

  it('rejects creating exams in the past', async () => {
    await expect(
      asUser.mutation(api.exams.create, {
        title: 'Past Exam',
        examAt: Date.now() - 60 * 1000,
        documentIds: [docId],
      }),
    ).rejects.toThrow('Exam date must be in the future')
  })

  it('rejects linking non-owned documents on update', async () => {
    const { userId: otherUserId } = await createAuthenticatedContext(t)
    const otherDocId = await createTestDocument(
      t,
      otherUserId,
      'Other User Doc',
    )
    const examId = await asUser.mutation(api.exams.create, {
      title: 'Chemistry Exam',
      examAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
      documentIds: [docId],
    })

    await expect(
      asUser.mutation(api.exams.update, {
        examId,
        documentIds: [otherDocId],
      }),
    ).rejects.toThrow('Document not found or access denied')
  })

  it('denies archive/unarchive/remove for non-owners', async () => {
    const { asUser: asOtherUser } = await createAuthenticatedContext(t)
    const examId = await asUser.mutation(api.exams.create, {
      title: 'Physics Final',
      examAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      documentIds: [docId],
    })

    await expect(
      asOtherUser.mutation(api.exams.archive, { examId }),
    ).rejects.toThrow('Exam not found or access denied')

    await expect(
      asOtherUser.mutation(api.exams.unarchive, { examId }),
    ).rejects.toThrow('Exam not found or access denied')

    await expect(
      asOtherUser.mutation(api.exams.remove, { examId }),
    ).rejects.toThrow('Exam not found or access denied')
  })

  it('only lists exams for the current user', async () => {
    const { asUser: asOtherUser, userId: otherUserId } =
      await createAuthenticatedContext(t)
    const otherDocId = await createTestDocument(
      t,
      otherUserId,
      'Other User Doc',
    )

    await asUser.mutation(api.exams.create, {
      title: 'Owner Exam',
      examAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      documentIds: [docId],
    })
    await asOtherUser.mutation(api.exams.create, {
      title: 'Other Exam',
      examAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      documentIds: [otherDocId],
    })

    const ownerExams = await asUser.query(api.exams.list, {
      includeArchived: true,
      includePast: true,
    })

    expect(ownerExams).toHaveLength(1)
    expect(ownerExams[0]?.title).toBe('Owner Exam')
  })

  it('returns link counts for filtered exams without leaking past exam links', async () => {
    const secondDocId = await createTestDocument(t, userId, 'Second Doc')
    const activeExamId = await asUser.mutation(api.exams.create, {
      title: 'Active Exam',
      examAt: Date.now() + 3 * DAY_MS,
      documentIds: [docId],
    })

    await t.run(async (ctx) => {
      const now = Date.now()
      const pastExamId = await ctx.db.insert('exams', {
        userId,
        title: 'Past Exam',
        examAt: now - DAY_MS,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('examDocuments', {
        userId,
        examId: pastExamId,
        documentId: secondDocId,
        createdAt: now,
      })
    })

    const activeExams = await asUser.query(api.exams.list, {
      includeArchived: false,
      includePast: false,
    })

    expect(activeExams).toHaveLength(1)
    const activeExam = activeExams.find((exam) => exam._id === activeExamId)
    expect(activeExam).toBeDefined()
    expect(activeExam?.linkedDocumentCount).toBe(1)
    expect(activeExam?.documentIds).toEqual([docId])
  })

  it('includes archived future exams when includeArchived is true and includePast is false', async () => {
    const secondDocId = await createTestDocument(t, userId, 'Second Doc')
    const activeExamId = await asUser.mutation(api.exams.create, {
      title: 'Active Exam',
      examAt: Date.now() + 2 * DAY_MS,
      documentIds: [docId],
    })
    const archivedFutureExamId = await asUser.mutation(api.exams.create, {
      title: 'Archived Future Exam',
      examAt: Date.now() + 4 * DAY_MS,
      documentIds: [secondDocId],
    })
    await asUser.mutation(api.exams.archive, { examId: archivedFutureExamId })

    await t.run(async (ctx) => {
      const now = Date.now()
      const pastExamId = await ctx.db.insert('exams', {
        userId,
        title: 'Past Exam',
        examAt: now - DAY_MS,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('examDocuments', {
        userId,
        examId: pastExamId,
        documentId: secondDocId,
        createdAt: now,
      })
    })

    const futureExams = await asUser.query(api.exams.list, {
      includeArchived: true,
      includePast: false,
    })

    expect(futureExams).toHaveLength(2)
    expect(futureExams.map((exam) => exam._id)).toEqual(
      expect.arrayContaining([activeExamId, archivedFutureExamId]),
    )
    expect(futureExams.every((exam) => exam.examAt > Date.now())).toBeTruthy()
    expect(
      futureExams.find((exam) => exam._id === archivedFutureExamId)?.archivedAt,
    ).toBeTypeOf('number')
  })

  it('removes exam-document links on exam deletion', async () => {
    const secondDocId = await createTestDocument(t, userId, 'Second Doc')
    const examId = await asUser.mutation(api.exams.create, {
      title: 'Linked Exam',
      examAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
      documentIds: [docId, secondDocId],
    })

    const linksBefore = await t.run(async (ctx) => {
      return await ctx.db
        .query('examDocuments')
        .filter((q) => q.eq(q.field('examId'), examId))
        .collect()
    })
    expect(linksBefore).toHaveLength(2)

    await asUser.mutation(api.exams.remove, { examId })

    const linksAfter = await t.run(async (ctx) => {
      return await ctx.db
        .query('examDocuments')
        .filter((q) => q.eq(q.field('examId'), examId))
        .collect()
    })
    expect(linksAfter).toHaveLength(0)
  })

  it('supports create, list, update, archive, and unarchive for the owner', async () => {
    const secondDocId = await createTestDocument(t, userId, 'Second Doc')
    const thirdDocId = await createTestDocument(t, userId, 'Third Doc')
    const initialExamAt = Date.now() + 6 * DAY_MS
    const updatedExamAt = Date.now() + 8 * DAY_MS

    const examId = await asUser.mutation(api.exams.create, {
      title: 'Lifecycle Exam',
      examAt: initialExamAt,
      notes: 'Initial notes',
      documentIds: [docId, secondDocId],
    })

    const createdExam = await asUser.query(api.exams.get, { examId })
    expect(createdExam.title).toBe('Lifecycle Exam')
    expect(createdExam.examAt).toBe(initialExamAt)
    expect(createdExam.notes).toBe('Initial notes')
    expect(createdExam.linkedDocumentCount).toBe(2)
    expect(createdExam.documentIds).toHaveLength(2)
    expect(createdExam.documentIds).toEqual(
      expect.arrayContaining([docId, secondDocId]),
    )
    expect(createdExam.archivedAt).toBeUndefined()

    const listedExams = await asUser.query(api.exams.list, {
      includeArchived: true,
      includePast: true,
    })
    const listedExam = listedExams.find((exam) => exam._id === examId)
    expect(listedExam).toBeDefined()
    expect(listedExam?.title).toBe('Lifecycle Exam')
    expect(listedExam?.linkedDocumentCount).toBe(2)

    await asUser.mutation(api.exams.update, {
      examId,
      title: 'Lifecycle Exam Updated',
      examAt: updatedExamAt,
      notes: 'Updated notes',
      documentIds: [thirdDocId],
    })

    const updatedExam = await asUser.query(api.exams.get, { examId })
    expect(updatedExam.title).toBe('Lifecycle Exam Updated')
    expect(updatedExam.examAt).toBe(updatedExamAt)
    expect(updatedExam.notes).toBe('Updated notes')
    expect(updatedExam.linkedDocumentCount).toBe(1)
    expect(updatedExam.documentIds).toEqual([thirdDocId])

    await asUser.mutation(api.exams.update, {
      examId,
      notes: '',
    })
    const clearedNotesExam = await asUser.query(api.exams.get, { examId })
    expect(clearedNotesExam.notes).toBe('')

    await asUser.mutation(api.exams.archive, { examId })
    const archivedExam = await asUser.query(api.exams.get, { examId })
    expect(archivedExam.archivedAt).toBeTypeOf('number')
    expect(archivedExam.updatedAt).toBeTypeOf('number')
    expect(archivedExam.updatedAt).toBeGreaterThanOrEqual(
      archivedExam.archivedAt ?? 0,
    )

    const activeOnlyExams = await asUser.query(api.exams.list, {})
    expect(activeOnlyExams.some((exam) => exam._id === examId)).toBe(false)

    await asUser.mutation(api.exams.unarchive, { examId })
    const unarchivedExam = await asUser.query(api.exams.get, { examId })
    expect(unarchivedExam.archivedAt).toBeUndefined()
  })
})
