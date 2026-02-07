import { Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SuggestionTone } from './suggestion-helpers'

import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { cn } from '@/lib/utils'

interface ActionSuggestionCardProps {
  title?: ReactNode
  tone?: SuggestionTone
  action?: ReactNode
  className?: string
  children: ReactNode
}

const toneClasses: Record<SuggestionTone, string> = {
  default: 'border-sky-500/25 bg-sky-500/5',
  warning: 'border-amber-500/30 bg-amber-500/10',
  success: 'border-emerald-500/30 bg-emerald-500/10',
}

export function ActionSuggestionCard({
  title = 'Suggestion',
  tone = 'default',
  action,
  className,
  children,
}: ActionSuggestionCardProps) {
  return (
    <AnalyticsCard
      muted
      className={cn('border px-6', toneClasses[tone], className)}
      padding="compact"
    >
      <div className="space-y-3 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground uppercase">
            <Lightbulb className="h-3.5 w-3.5" />
            {title}
          </p>
          {action ? <div>{action}</div> : null}
        </div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </AnalyticsCard>
  )
}
