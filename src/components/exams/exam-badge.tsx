import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ExamInfo {
  _id: string
  title: string
  examDate: number
  color?: string | null
  daysUntil: number
  isPast: boolean
}

interface ExamBadgeProps {
  exams: Array<ExamInfo>
  compact?: boolean
}

export function ExamBadge({ exams, compact = false }: ExamBadgeProps) {
  if (exams.length === 0) return null

  const activeExams = exams.filter((e) => !e.isPast)
  if (activeExams.length === 0) return null

  const nearestExam = activeExams[0]
  const daysText =
    nearestExam.daysUntil === 0
      ? 'Today'
      : nearestExam.daysUntil === 1
        ? '1 day'
        : `${nearestExam.daysUntil} days`

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="secondary" className="gap-1">
            <CalendarClock className="h-3 w-3" />
            {daysText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{nearestExam.title}</p>
          {activeExams.length > 1 && (
            <p className="text-xs text-muted-foreground">
              +{activeExams.length - 1} more exam
              {activeExams.length > 2 ? 's' : ''}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className="gap-1"
        style={
          nearestExam.color
            ? {
                backgroundColor: `${nearestExam.color}20`,
                color: nearestExam.color,
              }
            : undefined
        }
      >
        <CalendarClock className="h-3 w-3" />
        <span className="max-w-25 truncate">{nearestExam.title}</span>
        <span className="text-muted-foreground">({daysText})</span>
      </Badge>
      {activeExams.length > 1 && (
        <Badge variant="outline" className="text-xs">
          +{activeExams.length - 1}
        </Badge>
      )}
    </div>
  )
}
