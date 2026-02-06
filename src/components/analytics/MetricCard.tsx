import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { cn } from '@/lib/utils'

const metricValueVariants = cva('tracking-tight text-foreground', {
  variants: {
    variant: {
      hero: 'font-serif text-5xl leading-none sm:text-6xl',
      default: 'text-3xl leading-tight font-semibold',
      compact: 'text-2xl leading-tight font-semibold',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const metricLabelVariants = cva(
  'text-[0.625rem] leading-none font-medium tracking-[0.2em] text-muted-foreground uppercase',
  {
    variants: {
      variant: {
        hero: '',
        default: '',
        compact: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const metricContentVariants = cva('space-y-1 px-4', {
  variants: {
    variant: {
      hero: 'px-6',
      default: '',
      compact: 'space-y-0.5',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type MetricCardProps = VariantProps<typeof metricValueVariants> & {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  className?: string
  valueClassName?: string
}

function MetricCard({
  label,
  value,
  helper,
  variant = 'default',
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <AnalyticsCard
      data-slot="metric-card"
      padding={
        variant === 'compact'
          ? 'compact'
          : variant === 'hero'
            ? 'dense'
            : 'default'
      }
      className={className}
    >
      <div className={cn(metricContentVariants({ variant }))}>
        <p className={cn(metricLabelVariants({ variant }))}>{label}</p>
        <p
          className={cn(
            metricValueVariants({ variant, className: valueClassName }),
          )}
        >
          {value}
        </p>
        {helper ? (
          <p className="text-xs text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    </AnalyticsCard>
  )
}

export { MetricCard }
