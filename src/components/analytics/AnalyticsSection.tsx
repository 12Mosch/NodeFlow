import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AnalyticsSectionProps = ComponentProps<'section'> & {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  headerClassName?: string
  contentClassName?: string
}

function AnalyticsSection({
  title,
  description,
  action,
  className,
  headerClassName,
  contentClassName,
  children,
  ...props
}: AnalyticsSectionProps) {
  const hasHeader = title || description || action

  return (
    <section
      data-slot="analytics-section"
      className={cn('space-y-6', className)}
      {...props}
    >
      {hasHeader ? (
        <header
          data-slot="analytics-section-header"
          className={cn(
            'flex flex-wrap items-start justify-between gap-3 sm:items-end',
            headerClassName,
          )}
        >
          {(title || description) && (
            <div className="space-y-1">
              {title ? (
                <h2 className="text-xl leading-tight font-semibold tracking-tight text-pretty sm:text-2xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          )}
          {action ? (
            <div data-slot="analytics-section-action">{action}</div>
          ) : null}
        </header>
      ) : null}
      <div
        data-slot="analytics-section-content"
        className={cn('space-y-4', contentClassName)}
      >
        {children}
      </div>
    </section>
  )
}

export { AnalyticsSection }
