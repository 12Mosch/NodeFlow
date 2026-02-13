import type { DocumentExamIndicator } from '@/lib/exams'
import { Badge } from '@/components/ui/badge'
import { formatExamCountdown, formatExamDateTime } from '@/lib/exams'
import { pluralize } from '@/lib/pluralize'

interface DocumentExamIndicatorProps {
  indicator: DocumentExamIndicator | null | undefined
  variant: 'home' | 'sidebar' | 'header'
  now?: number
}

export function DocumentExamIndicatorView({
  indicator,
  variant,
  now,
}: DocumentExamIndicatorProps) {
  if (!indicator || indicator.activeExamCount <= 0) {
    return null
  }
  const countdown = formatExamCountdown(indicator.nextExamAt, now)
  if (variant === 'sidebar') {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
          {indicator.activeExamCount}
        </Badge>
        {countdown && (
          <span className="truncate text-[11px] text-sidebar-foreground/70">
            {countdown}
          </span>
        )}
      </div>
    )
  }
  return (
    <div
      className={
        variant === 'home'
          ? 'mt-1 flex flex-wrap items-center gap-2'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      <Badge variant="secondary" className="text-xs">
        {indicator.activeExamCount}{' '}
        {pluralize(indicator.activeExamCount, 'exam')}
      </Badge>
      {countdown && (
        <span className="text-xs text-muted-foreground">
          {indicator.nextExamTitle
            ? `${indicator.nextExamTitle} • ${countdown}`
            : countdown}
          {variant === 'header' && indicator.nextExamAt !== null && (
            <span className="ml-1">
              ({formatExamDateTime(indicator.nextExamAt)})
            </span>
          )}
        </span>
      )}
    </div>
  )
}
