import { ExamCard } from './exam-card'

interface ExamListProps {
  exams: Array<{
    _id: string
    title: string
    examDate: number
    color?: string | null
    isArchived: boolean
    documentCount: number
    cardCount: number
    daysUntil: number
    inRetrievabilityPeriod: boolean
    retrievabilityPeriodDays: number
    isPast: boolean
  }>
  onEditExam?: (examId: string) => void
  onArchiveExam?: (examId: string) => void
  onDeleteExam?: (examId: string) => void
}

export function ExamList({
  exams,
  onEditExam,
  onArchiveExam,
  onDeleteExam,
}: ExamListProps) {
  // Filter out past and archived exams for display
  const activeExams = exams.filter((e) => !e.isPast && !e.isArchived)

  if (activeExams.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {activeExams.map((exam) => (
        <ExamCard
          key={exam._id}
          exam={exam}
          onEdit={onEditExam ? () => onEditExam(exam._id) : undefined}
          onArchive={onArchiveExam ? () => onArchiveExam(exam._id) : undefined}
          onDelete={onDeleteExam ? () => onDeleteExam(exam._id) : undefined}
        />
      ))}
    </div>
  )
}
