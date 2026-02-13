import { AnalyticsSection, MetricCard } from '@/components/analytics'
import { formatExamCountdown } from '@/lib/exams'

interface ExamOverviewMetricsProps {
  activeExamCount: number
  nextExamAt: number | null
  nextExamTitle: string | null
  examPriorityCards: number
  now?: number
}

export function ExamOverviewMetrics({
  activeExamCount,
  nextExamAt,
  nextExamTitle,
  examPriorityCards,
  now,
}: ExamOverviewMetricsProps) {
  const nextExamCountdown = formatExamCountdown(nextExamAt, now)

  return (
    <AnalyticsSection
      title="Exam Pressure"
      description="Upcoming exam windows and queue risk for exam-linked material."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Active exams"
          value={activeExamCount}
          helper="future, unarchived exams"
        />
        <MetricCard
          label="Next exam"
          value={nextExamCountdown ?? '—'}
          helper={nextExamTitle ?? 'No upcoming exam'}
        />
        <MetricCard
          label="Exam-priority cards"
          value={examPriorityCards}
          helper="below 90% at nearest exam"
        />
      </div>
    </AnalyticsSection>
  )
}
