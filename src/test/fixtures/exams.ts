import { DAY_MS } from '@/lib/exams'

const now = new Date('2026-02-12T12:00:00.000Z').getTime()

export const activeExamFixture = {
  _id: 'exam_1',
  _creationTime: now,
  userId: 'user_1',
  title: 'Biology Midterm',
  examAt: now + 10 * DAY_MS,
  notes: 'Review chapter 3',
  archivedAt: undefined,
  createdAt: now,
  updatedAt: now,
  documentIds: ['doc_1'],
  linkedDocumentCount: 1,
}

export const examsFixture = [activeExamFixture]
