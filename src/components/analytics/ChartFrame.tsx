import type { ComponentProps, ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type ChartFrameProps = ComponentProps<'section'> & {
  caption?: ReactNode
  legend?: ReactNode
  empty?: ReactNode
  isEmpty?: boolean
  frameClassName?: string
  captionClassName?: string
  legendClassName?: string
}

function ChartFrame({
  caption,
  legend,
  empty,
  isEmpty = false,
  className,
  frameClassName,
  captionClassName,
  legendClassName,
  children,
  ...props
}: ChartFrameProps) {
  const hasMeta = caption || legend

  return (
    <section
      data-slot="chart-frame"
      className={cn('space-y-3', className)}
      {...props}
    >
      <div
        data-slot="chart-frame-body"
        className={cn(
          'rounded-lg border border-border/60 bg-muted/20 p-3',
          frameClassName,
        )}
      >
        {isEmpty ? (
          <div
            data-slot="chart-frame-empty"
            className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {empty ?? 'No data available yet.'}
          </div>
        ) : (
          children
        )}
      </div>
      {hasMeta ? (
        <div data-slot="chart-frame-meta" className="space-y-2">
          {caption ? (
            <p
              data-slot="chart-frame-caption"
              className={cn('text-xs text-muted-foreground', captionClassName)}
            >
              {caption}
            </p>
          ) : null}
          {caption && legend ? <Separator variant="muted" /> : null}
          {legend ? (
            <div
              data-slot="chart-frame-legend"
              className={cn(
                'flex flex-wrap items-center gap-3 text-xs text-muted-foreground',
                legendClassName,
              )}
            >
              {legend}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export { ChartFrame }
