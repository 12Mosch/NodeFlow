import {
  Archive,
  CalendarDays,
  Clock,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface ExamCardProps {
  exam: {
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
  }
  onEdit?: () => void
  onArchive?: () => void
  onDelete?: () => void
}

export function ExamCard({ exam, onEdit, onArchive, onDelete }: ExamCardProps) {
  const examDate = new Date(exam.examDate)
  const dateStr = examDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year:
      examDate.getFullYear() !== new Date().getFullYear()
        ? 'numeric'
        : undefined,
  })

  const urgencyLevel =
    exam.daysUntil <= 1
      ? 'critical'
      : exam.daysUntil <= 3
        ? 'high'
        : exam.daysUntil <= 7
          ? 'medium'
          : 'low'

  const urgencyColors = {
    critical: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    high: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    low: 'text-muted-foreground bg-muted',
  }

  const daysText =
    exam.daysUntil === 0
      ? 'Today'
      : exam.daysUntil === 1
        ? 'Tomorrow'
        : `${exam.daysUntil} days`

  // Calculate progress through retrievability period
  const periodProgress = exam.inRetrievabilityPeriod
    ? Math.round(
        ((exam.retrievabilityPeriodDays - exam.daysUntil) /
          exam.retrievabilityPeriodDays) *
          100,
      )
    : 0

  return (
    <Card
      className="relative overflow-hidden transition-shadow hover:shadow-md"
      style={
        exam.color
          ? { borderLeftColor: exam.color, borderLeftWidth: '4px' }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{exam.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{dateStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={urgencyColors[urgencyLevel]}>
              <Clock className="mr-1 h-3 w-3" />
              {daysText}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onArchive && (
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              {exam.documentCount} document{exam.documentCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-muted-foreground">
            {exam.cardCount} card{exam.cardCount !== 1 ? 's' : ''}
          </div>
        </div>

        {exam.inRetrievabilityPeriod && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Review period</span>
              <span className="font-medium">
                {exam.retrievabilityPeriodDays - exam.daysUntil} /{' '}
                {exam.retrievabilityPeriodDays} days
              </span>
            </div>
            <Progress value={periodProgress} className="h-1.5" />
          </div>
        )}

        {!exam.inRetrievabilityPeriod && exam.cardCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Review period starts in{' '}
            {exam.daysUntil - exam.retrievabilityPeriodDays} days
          </p>
        )}

        {exam.cardCount === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            No flashcards in linked documents
          </p>
        )}
      </CardContent>
    </Card>
  )
}
